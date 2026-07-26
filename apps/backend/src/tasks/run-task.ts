#!/usr/bin/env bun

import { and, eq, isNull, lt } from "drizzle-orm";
import { city, club, clubInvite } from "../drizzle/schema";
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
	 * Points every club at a row in the seeded `City` table, which is what the
	 * per-city landing pages group on.
	 *
	 * Two passes, cheapest first. Clubs that already carry a city name from before
	 * the reference table existed are matched against it by slug — no network calls
	 * and no ambiguity. Only what is left over is geocoded, preferring the
	 * coordinates the club pinned on the map and falling back to its free-form
	 * `location` text.
	 *
	 * A geocoder answer is a *lookup key*, never the stored value: whatever
	 * Nominatim returns has to match a real seeded city or the club is left alone.
	 * That is the point of the whole exercise. Reverse geocoding a Sarajevo pin can
	 * answer "Mjesna zajednica Trg oslobođenja-Centar", and forward geocoding once
	 * produced "Jablanicai"; before, both became live landing pages, and now
	 * neither matches anything and both are reported for a human instead.
	 *
	 * Safe to re-run: it only looks at rows where `cityId` is still null, so an
	 * interrupted run resumes where it stopped and hand-fixed clubs are never
	 * overwritten.
	 */
	"link-club-cities": async () => {
		logger.emit({
			severityText: "info",
			body: "Running task: link-club-cities",
		});

		const pending = await db
			.select({
				id: club.id,
				name: club.name,
				countryId: club.countryId,
				city: club.city,
				location: club.location,
				latitude: club.latitude,
				longitude: club.longitude,
			})
			.from(club)
			.where(isNull(club.cityId));

		/**
		 * Cities of one country, keyed by the slug of their name rather than by the
		 * name itself, so "Zivinice" typed without diacritics still finds "Živinice".
		 * Loaded per country and cached: the clubs cluster into a handful of
		 * countries, and a per-club query against 148k rows would be wasteful.
		 *
		 * A slug that maps to more than one city is genuinely ambiguous — BiH has a
		 * Živinice in each entity — and is left for a human to pick.
		 */
		const cityIndexByCountry = new Map<number, Map<string, Array<{ id: number; name: string; slug: string }>>>();

		async function cityIndexFor(countryId: number) {
			const cached = cityIndexByCountry.get(countryId);
			if (cached) {
				return cached;
			}
			const rows = await db
				.select({ id: city.id, name: city.name, slug: city.slug })
				.from(city)
				.where(and(eq(city.countryId, countryId), eq(city.enabled, true)));

			const index = new Map<string, Array<{ id: number; name: string; slug: string }>>();
			for (const row of rows) {
				const key = slugifyCity(normalizeCityName(row.name));
				if (!key) {
					continue;
				}
				const bucket = index.get(key);
				if (bucket) {
					bucket.push(row);
				} else {
					index.set(key, [row]);
				}
			}
			cityIndexByCountry.set(countryId, index);
			return index;
		}

		type Match = { id: number; name: string; slug: string };

		async function matchCity(countryId: number | null, name: string | null): Promise<Match | "ambiguous" | null> {
			if (countryId === null || !name) {
				return null;
			}
			const key = slugifyCity(normalizeCityName(name));
			if (!key) {
				return null;
			}
			const candidates = (await cityIndexFor(countryId)).get(key);
			if (!candidates || candidates.length === 0) {
				return null;
			}
			return candidates.length === 1 ? (candidates[0] as Match) : "ambiguous";
		}

		let linked = 0;
		let ambiguous = 0;
		const unresolved: Array<{ id: string; name: string; tried: string }> = [];
		let geocodeCalls = 0;

		for (const row of pending) {
			// The name the club already carries is free, so try it before the network.
			let candidateName = row.city;
			let match = await matchCity(row.countryId, candidateName);

			if (match === null) {
				// Rate limit between geocoder calls, not before the first one.
				if (geocodeCalls > 0) {
					await sleep(NOMINATIM_DELAY_MS);
				}
				geocodeCalls += 1;

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

				candidateName = pickCity(address ?? undefined);
				match = await matchCity(row.countryId, candidateName);
			}

			if (match === "ambiguous") {
				ambiguous += 1;
				console.log(`  ? ${row.name} — "${candidateName}" matches more than one city, pick one by hand`);
				continue;
			}

			if (!match) {
				unresolved.push({ id: row.id, name: row.name, tried: candidateName ?? row.location ?? "—" });
				console.log(
					`  ? ${row.name} — no seeded city matched (tried "${candidateName ?? row.location ?? "—"}")`,
				);
				continue;
			}

			await db
				.update(club)
				.set({ cityId: match.id, city: match.name, citySlug: match.slug })
				.where(eq(club.id, row.id));
			linked += 1;
			console.log(`  ✓ ${row.name} → ${match.name}`);
		}

		logger.emit({
			severityText: "info",
			body: "Link club cities completed",
			attributes: {
				candidateCount: pending.length.toString(),
				linkedCount: linked.toString(),
				ambiguousCount: ambiguous.toString(),
				unresolvedCount: unresolved.length.toString(),
			},
		});
		console.log(
			`\nLinked ${linked} of ${pending.length} clubs (${ambiguous} ambiguous, ${unresolved.length} unmatched).`,
		);
		if (unresolved.length > 0) {
			console.log("\nThese need a city picked by hand in club settings:");
			for (const row of unresolved) {
				console.log(`  - ${row.name} (${row.id}) — tried "${row.tried}"`);
			}
		}
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
