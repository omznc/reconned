/**
 * Gives a logo tile to the clubs whose logo was uploaded before the upload form chose one.
 * It runs the same rule as the upload form (`analyzePixels`), on pixels that sharp decodes.
 * It writes only rows whose tile is still NULL, so it never overrides an owner's choice.
 *
 * Usage: DATABASE_URL=... bun scripts/backfill-logo-tiles.ts [--apply]
 * Without --apply it only prints what it would change.
 */
import { SQL } from "bun";
import sharp from "sharp";
import { analyzePixels, SAMPLE_SIZE } from "../src/lib/logo-analysis";

const apply = process.argv.includes("--apply");
const db = new SQL(process.env.DATABASE_URL ?? "");

async function tileOf(url: string) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}
	const { data, info } = await sharp(Buffer.from(await response.arrayBuffer()))
		.resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "inside", withoutEnlargement: true })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	return analyzePixels(data, info.width, info.height);
}

const clubs: { id: string; name: string; logo: string }[] =
	await db`SELECT id, name, logo FROM "Club" WHERE logo IS NOT NULL AND logo <> '' AND "logoTile" IS NULL`;

let changed = 0;
for (const club of clubs) {
	try {
		const { tile, luminance } = await tileOf(club.logo);
		console.log(`${tile.padEnd(5)} ${luminance.toFixed(2)}  ${club.name}`);
		if (apply) {
			await db`UPDATE "Club" SET "logoTile" = ${tile} WHERE id = ${club.id} AND "logoTile" IS NULL`;
		}
		changed++;
	} catch (error) {
		console.error(`skip  ${club.name}: ${error instanceof Error ? error.message : error}`);
	}
}

console.log(`${apply ? "Set" : "Would set"} ${changed} of ${clubs.length} tiles.`);
await db.close();
