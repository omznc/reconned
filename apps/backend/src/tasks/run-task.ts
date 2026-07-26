#!/usr/bin/env bun

import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import { club, clubInvite } from "../drizzle/schema";
import { normalizeCityName, slugifyCity } from "../lib/city";
import { db } from "../lib/db";
import { logger } from "../lib/posthog";

/**
 * Nominatim's usage policy allows at most one request per second and requires a
 * User-Agent that identifies the application. Both are honoured below; the delay
 * is deliberately over a second so clock jitter cannot push two calls into the
 * same window.
 */
const NOMINATIM_DELAY_MS = 1100;
const NOMINATIM_USER_AGENT = "AirsoftClubManagement/1.0";

/** `zoom=10` is Nominatim's city level — finer zooms return suburbs and streets. */
const NOMINATIM_CITY_ZOOM = 10;

type NominatimAddress = {
	city?: string;
	town?: string;
	village?: string;
	municipality?: string;
	county?: string;
	state?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Picks the most specific populated place Nominatim returned. The fields are not
 * mutually exclusive and which one is present varies by country: Bosnian results
 * are usually `city` or `town`, but smaller places only carry `village` or
 * `municipality`, and `county` is the last thing still worth grouping clubs by.
 */
function pickCity(address: NominatimAddress | undefined): string | null {
	if (!address) {
		return null;
	}
	const city = address.city || address.town || address.village || address.municipality || address.county;
	return city ? normalizeCityName(city) : null;
}

async function geocode(url: string): Promise<NominatimAddress | null> {
	const response = await fetch(url, {
		headers: {
			"accept-language": "bs",
			"user-agent": NOMINATIM_USER_AGENT,
		},
	});

	if (!response.ok) {
		return null;
	}

	const body = (await response.json()) as { address?: NominatimAddress } | Array<{ address?: NominatimAddress }>;

	// The reverse endpoint returns one object, the search endpoint an array.
	return (Array.isArray(body) ? body[0]?.address : body.address) ?? null;
}

const tasks: Record<string, () => Promise<void>> = {
	/**
	 * Fills `city`/`citySlug` for clubs that predate those columns, so they appear
	 * on the per-city landing pages. Prefers reverse-geocoding the coordinates the
	 * club picked on the map; falls back to forward-geocoding the free-form
	 * `location` text for clubs that never set a pin.
	 *
	 * Safe to re-run: it only ever looks at rows where `citySlug` is still null, so
	 * an interrupted run resumes where it stopped and manual edits are never
	 * overwritten.
	 */
	"backfill-club-cities": async () => {
		logger.emit({
			severityText: "info",
			body: "Running task: backfill-club-cities",
		});

		const pending = await db
			.select({
				id: club.id,
				name: club.name,
				location: club.location,
				latitude: club.latitude,
				longitude: club.longitude,
			})
			.from(club)
			.where(
				and(
					isNull(club.citySlug),
					or(and(isNotNull(club.latitude), isNotNull(club.longitude)), isNotNull(club.location)),
				),
			);

		let updated = 0;
		let unresolved = 0;

		for (const [index, row] of pending.entries()) {
			// Rate limit between calls, not before the first one.
			if (index > 0) {
				await sleep(NOMINATIM_DELAY_MS);
			}

			const url =
				row.latitude !== null && row.longitude !== null
					? `https://nominatim.openstreetmap.org/reverse?lat=${row.latitude}&lon=${row.longitude}&format=json&zoom=${NOMINATIM_CITY_ZOOM}`
					: `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(row.location ?? "")}&format=json&limit=1&addressdetails=1`;

			const address = await geocode(url).catch((error: unknown) => {
				logger.emit({
					severityText: "warn",
					body: "Geocoding request failed",
					attributes: {
						clubId: row.id,
						error: error instanceof Error ? error.message : String(error),
					},
				});
				return null;
			});

			const city = pickCity(address ?? undefined);
			// An unsluggable name would write a citySlug that no landing page can be
			// routed to, so it counts as unresolved and the row stays eligible.
			const citySlug = city ? slugifyCity(city) : "";
			if (!city || !citySlug) {
				unresolved += 1;
				console.log(`  ? ${row.name} — no city resolved`);
				continue;
			}

			await db.update(club).set({ city, citySlug }).where(eq(club.id, row.id));
			updated += 1;
			console.log(`  ✓ ${row.name} → ${city}`);
		}

		logger.emit({
			severityText: "info",
			body: "Backfill club cities completed",
			attributes: {
				candidateCount: pending.length.toString(),
				unresolvedCount: unresolved.toString(),
				updatedCount: updated.toString(),
			},
		});
		console.log(`\nResolved ${updated} of ${pending.length} clubs (${unresolved} unresolved).`);
	},

	"clean-expired-invites": async () => {
		logger.emit({
			severityText: "info",
			body: "Running task: clean-expired-invites",
		});
		const now = new Date().toISOString();

		const result = await db
			.delete(clubInvite)
			.where(lt(clubInvite.expiresAt, now))
			.returning({ id: clubInvite.id });

		logger.emit({
			severityText: "info",
			body: "Clean expired invites completed",
			attributes: {
				deletedCount: result.length.toString(),
			},
		});
	},
};

async function main() {
	const args = process.argv.slice(2);
	const taskName = args[0];

	if (!taskName || taskName === "--list" || taskName === "-l") {
		logger.emit({
			severityText: "info",
			body: "Listing available tasks",
			attributes: {
				taskNames: JSON.stringify(Object.keys(tasks)),
			},
		});
		console.log("\nAvailable tasks:");
		for (const name of Object.keys(tasks)) {
			console.log(`  - ${name}`);
		}
		console.log("\nUsage: bun run src/tasks/run-task.ts <task-name>");
		process.exit(0);
	}

	const task = tasks[taskName];
	if (!task) {
		logger.emit({
			severityText: "error",
			body: "Task not found",
			attributes: {
				taskName,
				availableTasks: JSON.stringify(Object.keys(tasks)),
			},
		});
		console.error(`❌ Task not found: ${taskName}`);
		console.log("\nAvailable tasks:");
		for (const name of Object.keys(tasks)) {
			console.log(`  - ${name}`);
		}
		process.exit(1);
	}

	const startTime = Date.now();
	try {
		await task();
		const duration = Date.now() - startTime;
		logger.emit({
			severityText: "info",
			body: "Task completed successfully",
			attributes: {
				taskName,
				duration: duration.toString(),
			},
		});
		console.log(`\n✓ Task completed in ${duration}ms`);
		process.exit(0);
	} catch (error) {
		logger.emit({
			severityText: "error",
			body: "Task execution failed",
			attributes: {
				taskName,
				error: error instanceof Error ? error.message : String(error),
			},
		});
		console.error("\n❌ Task failed:", error);
		process.exit(1);
	}
}

main();
