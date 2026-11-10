/**
 * Visual identity for clubs and people.
 *
 * Clubs are squares, people are circles — that one difference carries the whole
 * distinction, so a player and a club never get confused in a mixed list.
 *
 * A club without a logo gets a generated mark: a dark hatched field with white
 * condensed initials. A person without a photo gets a pale tint with ink
 * initials — quieter, because a person's avatar usually sits next to their name
 * rather than standing alone.
 *
 * Everything here is deterministic: a club's mark never changes.
 */

import type { CSSProperties } from "react";

/** Positive 32-bit hash. Same string always lands on the same field/tint. */
export function identityHash(value: string): number {
	let h = 0;
	for (let i = 0; i < value.length; i++) {
		h = (h * 31 + value.charCodeAt(i)) >>> 0;
	}
	return h;
}

/** Field colour + hatch angle pairs for generated club marks. */
const CLUB_FIELDS: ReadonlyArray<readonly [string, number]> = [
	["#4a5240", 135],
	["#3a4a55", 45],
	["#7a5230", 135],
	["#5a4a64", 45],
	["#2c3630", 120],
	["#6a3a3a", 135],
] as const;

/** Pale tint + ink pairs for generated person avatars. */
const PERSON_TINTS: ReadonlyArray<readonly [string, string]> = [
	["#e4e7dd", "#3f4736"],
	["#dde4e8", "#334450"],
	["#eae0d6", "#5c4530"],
	["#e3dee8", "#4a3f58"],
	["#dee6e0", "#31463a"],
	["#ece0e0", "#5e3838"],
] as const;

/** Tile behind an uploaded logo. Paper is the default; ink rescues light logos. */
export type LogoTile = "paper" | "ink";

export const TILE_PAPER = "#faf8f4";
export const TILE_PAPER_BORDER = "#e4e0d8";
export const TILE_INK = "#22211f";

/** The hatch turns to noise below this size, so it is dropped. */
const HATCH_MIN_SIZE = 40;
/** Below this, initials are dropped and the field or tint stands alone. */
const INITIALS_MIN_SIZE = 24;

export const CLUB_RADIUS_RATIO = 0.21;
const CLUB_INITIALS_RATIO = 0.39;
const PERSON_INITIALS_RATIO = 0.37;

/**
 * Hatch stripe geometry, widened with the mark so the texture reads the same at
 * every size instead of collapsing into a flat wash on large surfaces.
 */
function hatchSteps(size: number): readonly [number, number] {
	if (size < 56) {
		return [3, 8];
	}
	if (size < 80) {
		return [4, 11];
	}
	if (size < 128) {
		return [5, 14];
	}
	return [6, 16];
}

function hatch(angle: number, size: number, alpha = 0.07): string {
	const [stripe, gap] = hatchSteps(size);
	return `repeating-linear-gradient(${angle}deg,rgba(255,255,255,${alpha}) 0 ${stripe}px,transparent ${stripe}px ${gap}px)`;
}

export interface GeneratedClubMark {
	/** Field colour, also used for the club's banner fallback. */
	color: string;
	/** Hatch angle in degrees. */
	angle: number;
	initials: string;
	/** Ready-to-spread inline style for the tile. */
	style: {
		backgroundColor: string;
		backgroundImage?: string;
		borderRadius: number;
	};
	/** Font size for the initials, or null when the mark is too small for them. */
	initialsSize: number | null;
}

export interface GeneratedPersonAvatar {
	/** Pale tint behind the initials. */
	color: string;
	/** Ink used for the initials. */
	ink: string;
	initials: string;
	initialsSize: number | null;
}

const CLUB_SKIP_WORDS = new Set(["ask", "ak", "sk", "klub", "club", "team", "airsoft", "the"]);

function words(name: string): string[] {
	return name.split(/[\s\-_.]+/).filter((word) => word.length > 1);
}

function firstLetters(source: string[], count: number): string {
	return source
		.slice(0, count)
		.map((word) => (word[0] ?? "").toUpperCase())
		.join("");
}

/**
 * Two initials by default, three when the name gives three. Generic words are
 * dropped, but never below two words — a one-letter mark reads as an error.
 */
export function clubInitials(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) {
		return "";
	}

	const all = words(trimmed);
	const kept = all.filter((word) => !CLUB_SKIP_WORDS.has(word.toLowerCase()));
	const source = kept.length >= 2 ? kept : all;
	const initials = firstLetters(source, source.length >= 3 ? 3 : 2);

	// A single-word name ("Vukovi") would otherwise yield one letter. Take the
	// first two characters of the word instead so the mark still reads as a mark.
	if (initials.length < 2) {
		return (
			trimmed
				.replace(/[^\p{L}\p{N}]/gu, "")
				.slice(0, 2)
				.toUpperCase() || initials
		);
	}
	return initials;
}

/** Two initials maximum. Diacritics are kept as typed. */
export function personInitials(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) {
		return "";
	}

	const initials = firstLetters(words(trimmed), 2);
	if (initials.length < 2) {
		return (
			trimmed
				.replace(/[^\p{L}\p{N}]/gu, "")
				.slice(0, 2)
				.toUpperCase() || initials
		);
	}
	return initials;
}

/** Field colour a club hashes to, used by both its mark and its banner. */
export function clubField(name: string): readonly [string, number] {
	const field = CLUB_FIELDS[identityHash(name) % CLUB_FIELDS.length];
	// CLUB_FIELDS is non-empty, but the index signature is not known to be total.
	return field ?? (["#2c3630", 135] as const);
}

export function generatedClubMark(name: string, size: number): GeneratedClubMark {
	const [color, angle] = clubField(name);
	return {
		color,
		angle,
		initials: clubInitials(name),
		style: {
			backgroundColor: color,
			...(size >= HATCH_MIN_SIZE ? { backgroundImage: hatch(angle, size) } : {}),
			borderRadius: Math.round(size * CLUB_RADIUS_RATIO),
		},
		initialsSize: size >= INITIALS_MIN_SIZE ? Math.round(size * CLUB_INITIALS_RATIO) : null,
	};
}

/** Pale tint + ink a person hashes to. Size-independent. */
export function personTint(name: string): readonly [string, string] {
	return PERSON_TINTS[identityHash(name) % PERSON_TINTS.length] ?? (["#dde4e8", "#334450"] as const);
}

export function generatedPersonAvatar(name: string, size: number): GeneratedPersonAvatar {
	const [color, ink] = personTint(name);
	return {
		color,
		ink,
		initials: personInitials(name),
		initialsSize: size >= INITIALS_MIN_SIZE ? Math.round(size * PERSON_INITIALS_RATIO) : null,
	};
}

/** Inline style for the tile sitting behind an uploaded logo. */
export function logoTileStyle(tile: LogoTile, size: number): CSSProperties {
	return {
		backgroundColor: tile === "ink" ? TILE_INK : TILE_PAPER,
		...(tile === "paper" ? { boxShadow: `inset 0 0 0 1px ${TILE_PAPER_BORDER}` } : {}),
		borderRadius: Math.round(size * CLUB_RADIUS_RATIO),
	};
}

function darken(hex: string, amount: number): string {
	const value = hex.replace("#", "");
	const full =
		value.length === 3
			? value
					.split("")
					.map((c) => c + c)
					.join("")
			: value;
	const num = Number.parseInt(full, 16);
	const channels = [(num >> 16) & 255, (num >> 8) & 255, num & 255].map((c) =>
		Math.max(0, Math.round(c * (1 - amount))),
	);
	return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Banner fill for an entity with no uploaded banner: the avatar's hashed field
 * colour, one step darker, at the same hatch. The page still looks composed
 * rather than empty.
 */
export function bannerFallbackStyle(name: string, kind: "club" | "person"): CSSProperties {
	const [color, angle] = kind === "club" ? clubField(name) : personBannerField(name);
	return {
		backgroundColor: darken(color, 0.12),
		backgroundImage: hatch(angle, 150, 0.05),
	};
}

/**
 * People hash to pale tints, which are far too light to fill a banner. Their
 * banner borrows the club field table on the same hash, so a person's header
 * and avatar stay in related hues.
 */
function personBannerField(name: string): readonly [string, number] {
	return clubField(name);
}
