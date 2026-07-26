#!/usr/bin/env bun

import { City as CityData } from "country-state-city";
import { sql } from "drizzle-orm";
import { city, country } from "../drizzle/schema";
import { slugifyCity } from "../lib/city";
import { db } from "../lib/db";
import { logger } from "../lib/posthog";

/**
 * Countries whose cities are slugged first, and so get the short, unsuffixed URLs.
 * Everything else follows in ISO order. This only decides who wins a slug
 * collision — every city is seeded either way.
 */
const PRIORITY_ISO2 = ["BA", "HR", "RS", "ME", "SI", "MK"];

/** Postgres caps a single statement's parameters; 148k rows have to go in batches. */
const BATCH_SIZE = 2000;

type SourceCity = {
	name: string;
	countryCode: string;
	stateCode: string;
	latitude: string | null;
	longitude: string | null;
};

/**
 * Orders the dataset so slug assignment is deterministic across runs: priority
 * countries first, then ISO code, then subdivision, then name. Re-seeding after a
 * dataset update therefore hands out the same slugs it did before, which matters
 * because those slugs are live URLs.
 */
function seedOrder(a: SourceCity, b: SourceCity): number {
	const aPriority = PRIORITY_ISO2.indexOf(a.countryCode);
	const bPriority = PRIORITY_ISO2.indexOf(b.countryCode);
	const aRank = aPriority === -1 ? PRIORITY_ISO2.length : aPriority;
	const bRank = bPriority === -1 ? PRIORITY_ISO2.length : bPriority;
	if (aRank !== bRank) {
		return aRank - bRank;
	}
	if (a.countryCode !== b.countryCode) {
		return a.countryCode.localeCompare(b.countryCode);
	}
	if (a.stateCode !== b.stateCode) {
		return a.stateCode.localeCompare(b.stateCode);
	}
	return a.name.localeCompare(b.name);
}

/**
 * City names collide — worldwide (10,170 slugs are shared) and even inside one
 * country: BiH has a Živinice in each entity. The slug is the routing key for
 * `/clubs/city/[citySlug]`, so it has to be globally unique. First claimant keeps
 * the bare slug; later ones take the narrowest suffix that is still free.
 */
function uniqueSlug(base: string, source: SourceCity, taken: Set<string>): string {
	const iso2 = source.countryCode.toLowerCase();
	const stateCode = slugifyCity(source.stateCode);
	const candidates = [base, `${base}-${iso2}`, stateCode ? `${base}-${iso2}-${stateCode}` : ""];

	for (const candidate of candidates) {
		if (candidate && !taken.has(candidate)) {
			return candidate;
		}
	}

	// Exhausted the meaningful suffixes — two rows in the same country and
	// subdivision share a name. A counter is arbitrary but stable under `seedOrder`.
	let counter = 2;
	while (taken.has(`${base}-${iso2}-${counter}`)) {
		counter += 1;
	}
	return `${base}-${iso2}-${counter}`;
}

async function main() {
	const now = new Date().toISOString();

	const countries = await db.select({ id: country.id, iso2: country.iso2 }).from(country);
	if (countries.length === 0) {
		throw new Error("No countries seeded — run `bun run db:seed` before seeding cities.");
	}
	// `iso2` is `char(2)`, which Postgres returns blank-padded in some drivers.
	const countryIdByIso2 = new Map(countries.map((row) => [row.iso2.trim().toUpperCase(), row.id]));

	const source = (CityData.getAllCities() as SourceCity[]).slice().sort(seedOrder);

	const taken = new Set<string>();
	const rows: Array<typeof city.$inferInsert> = [];
	let skippedNoSlug = 0;
	let skippedNoCountry = 0;

	for (const entry of source) {
		const countryId = countryIdByIso2.get(entry.countryCode.toUpperCase());
		if (countryId === undefined) {
			skippedNoCountry += 1;
			continue;
		}

		const base = slugifyCity(entry.name);
		if (!base) {
			// A name with nothing sluggable in it cannot be routed to, so a row for it
			// would be a city that no landing page can ever display.
			skippedNoSlug += 1;
			continue;
		}

		const slug = uniqueSlug(base, entry, taken);
		taken.add(slug);

		rows.push({
			countryId,
			name: entry.name,
			slug,
			stateCode: entry.stateCode || null,
			latitude: entry.latitude || null,
			longitude: entry.longitude || null,
			updatedAt: now,
		});
	}

	for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
		const batch = rows.slice(offset, offset + BATCH_SIZE);
		await db
			.insert(city)
			.values(batch)
			.onConflictDoUpdate({
				target: city.slug,
				set: {
					countryId: sql`excluded."countryId"`,
					name: sql`excluded."name"`,
					stateCode: sql`excluded."stateCode"`,
					latitude: sql`excluded."latitude"`,
					longitude: sql`excluded."longitude"`,
					updatedAt: sql`excluded."updatedAt"`,
				},
			});
		console.log(`  seeded ${Math.min(offset + BATCH_SIZE, rows.length)} / ${rows.length}`);
	}

	console.log(
		`Seeded ${rows.length} cities (${skippedNoSlug} unsluggable, ${skippedNoCountry} without a matching country).`,
	);

	logger.emit({
		severityText: "info",
		body: "City seed completed",
		attributes: { seeded: rows.length, skippedNoSlug, skippedNoCountry },
	});
}

main()
	.then(() => process.exit(0))
	.catch((error: unknown) => {
		console.error("City seed failed:", error);
		process.exit(1);
	});
