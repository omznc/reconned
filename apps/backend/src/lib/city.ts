import { eq } from "drizzle-orm";
import { city } from "../drizzle/schema";
import { db } from "./db";

/**
 * Administrative prefixes that geocoders attach to the unit rather than the
 * place: Nominatim answers "Sarajevo" with `city: "Grad Sarajevo"` and
 * "Doboj Jug" with `municipality: "Općina Doboj Jug"`. Nobody searches for those,
 * and left in they would split one city across two landing pages depending on
 * which address field the lookup happened to fall through to.
 *
 * The trailing space in each is load-bearing — it keeps "Gradiška" and
 * "Gradačac" from being mistaken for a prefixed "Grad".
 */
const ADMINISTRATIVE_PREFIXES = ["Grad ", "Град ", "Općina ", "Opština ", "Opcina ", "Општина ", "City of "];

/**
 * Serbian Cyrillic → Latin, the standard one-to-one mapping (with the three
 * digraphs љ/њ/џ). Without it a Cyrillic city name — which either an `sr` user
 * or a geocoder answering in Cyrillic can produce — slugifies to the empty
 * string, since the slug keeps only `a-z0-9`, and the landing page URL breaks.
 *
 * Order matters for the digraphs: they are expanded first, so `Љ` cannot be
 * mistaken for a bare `Л`.
 */
const CYRILLIC_TO_LATIN: Record<string, string> = {
	Љ: "Lj",
	Њ: "Nj",
	Џ: "Dz",
	љ: "lj",
	њ: "nj",
	џ: "dz",
	А: "A",
	Б: "B",
	В: "V",
	Г: "G",
	Д: "D",
	Ђ: "Đ",
	Е: "E",
	Ж: "Ž",
	З: "Z",
	И: "I",
	Ј: "J",
	К: "K",
	Л: "L",
	М: "M",
	Н: "N",
	О: "O",
	П: "P",
	Р: "R",
	С: "S",
	Т: "T",
	Ћ: "Ć",
	У: "U",
	Ф: "F",
	Х: "H",
	Ц: "C",
	Ч: "Č",
	Ш: "Š",
	а: "a",
	б: "b",
	в: "v",
	г: "g",
	д: "d",
	ђ: "đ",
	е: "e",
	ж: "ž",
	з: "z",
	и: "i",
	ј: "j",
	к: "k",
	л: "l",
	м: "m",
	н: "n",
	о: "o",
	п: "p",
	р: "r",
	с: "s",
	т: "t",
	ћ: "ć",
	у: "u",
	ф: "f",
	х: "h",
	ц: "c",
	ч: "č",
	ш: "š",
};

/** Display form of a city name: the place itself, without the admin wrapper. */
export function normalizeCityName(city: string): string {
	const trimmed = city.trim();
	const prefix = ADMINISTRATIVE_PREFIXES.find((candidate) =>
		trimmed.toLowerCase().startsWith(candidate.toLowerCase()),
	);
	return prefix ? trimmed.slice(prefix.length).trim() : trimmed;
}

/**
 * URL form of a city name, used as the key for the per-city club landing pages.
 *
 * `đ`/`Đ` are handled separately from the NFD pass because they are single code
 * points with no combining-mark decomposition, so stripping diacritics alone
 * would leave them intact and produce a non-ASCII slug. Everything else in the
 * Bosnian/Croatian/Serbian set (č, ć, ž, š) decomposes normally.
 *
 * Returns the empty string for a name with nothing sluggable in it; callers
 * treat that as "no city" rather than writing a slug that cannot be routed.
 *
 * Shared by the city seed and the `link-club-cities` task, so the slug a city is
 * seeded with is the same one an existing club's free-text name resolves to.
 */
export function slugifyCity(city: string): string {
	return city
		.replace(/[Ѐ-ӿ]/g, (char) => CYRILLIC_TO_LATIN[char] ?? char)
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** The `Club` columns that describe a city, as they are stored. */
export type ClubCityColumns = {
	cityId: number | null;
	city: string | null;
	citySlug: string | null;
};

/** Cleared city columns, for a club that names no city. */
export const NO_CITY: ClubCityColumns = { cityId: null, city: null, citySlug: null };

/**
 * Turns a chosen `City` row into the three columns stored on the club.
 *
 * `city` and `citySlug` are copies rather than joins so the landing-page queries
 * stay single-table; because they are copied from one row, two clubs in the same
 * city cannot disagree about how it is spelled. Returns `null` for an id that is
 * not a real city, which callers surface as a validation error rather than
 * silently storing a club with no city.
 */
export async function resolveClubCity(cityId: number): Promise<ClubCityColumns | null> {
	const [row] = await db
		.select({ id: city.id, name: city.name, slug: city.slug })
		.from(city)
		.where(eq(city.id, cityId))
		.limit(1);

	return row ? { cityId: row.id, city: row.name, citySlug: row.slug } : null;
}
