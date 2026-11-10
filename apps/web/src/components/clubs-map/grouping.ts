import type { CSSProperties } from "react";
import type { MapClub } from "@/components/clubs-map/clubs-map";
import { type LatLng, type Point, pixelDistance, project, unproject } from "@/components/clubs-map/geo";

// Zoom values in this file count a 256px world at zoom 0, see geo.ts.

// Grouping — pins that would collide collapse into one pin carrying a count.
//
// The old behaviour spread overlapping clubs out into a grid unconditionally,
// which invented locations that don't exist. Grouping instead admits the
// overlap: one pin, one number, and a zoom that resolves it.
//
// Clubs sharing a coordinate exactly have no such zoom, so once you're close
// enough that the shared point is unambiguous they fan out around it on leader
// lines instead. The lines are what keep that honest — every pin still says
// "my location is the dot in the middle", it just says it somewhere legible.
export const PIN_SIZE = 44; // Default plate, in pixels
export const PIN_FAR_SIZE = 28; // Zoomed out, no inner frame
export const PIN_SELECTED_SIZE = 56;
const PIN_GAP = 8; // Breathing room between two pins before they merge
export const FAR_ZOOM = 9; // At or below this, pins drop to their small form
export const MAX_ZOOM = 19; // As far in as the basemap goes, and the limit grouping is judged against

/**
 * Where fanning starts. The fan is measured in screen pixels, so it works at any
 * zoom — but at a country's worth of scale its arms would read as clubs sitting
 * kilometres apart. By this zoom the arms span roughly a block, which is close
 * enough to the truth for the leader lines to carry the rest.
 */
export const SPREAD_ZOOM = 16;
/** Past this many, a ring of pins is worse than a list. */
export const SPREAD_MAX = 12;
/** Keeps a pair from fanning into a barbell so small it reads as one pin. */
const SPREAD_MIN_RADIUS = 46;

/**
 * Every pin is drawn once at PIN_SIZE and then scaled, so a size change is a
 * transform the browser can animate rather than a relayout that snaps. The
 * collision threshold still needs the on-screen size, which is what this gives.
 */
function pinSizeForZoom(zoom: number): number {
	return zoom <= FAR_ZOOM ? PIN_FAR_SIZE : PIN_SIZE;
}

export interface SpreadClub {
	club: MapClub;
	/** Where the pin is drawn — on the ring, not on the club's own coordinate. */
	position: LatLng;
}

export interface ClubGroup {
	/** Stable across renders for the same membership, so markers aren't recreated. */
	key: string;
	clubs: MapClub[];
	center: LatLng;
	/**
	 * The zoom that breaks this group back into individual pins, or null when no
	 * zoom does — the common case being clubs pinned to the same town's
	 * coordinates exactly.
	 */
	openZoom: number | null;
	/**
	 * Set once the group is fanned out: one entry per member, each with the ring
	 * position its pin is drawn at. Null while the group is still a counted pin.
	 */
	spread: SpreadClub[] | null;
}

interface PlacedClub {
	club: MapClub;
	point: Point;
}

/** The pre-translated hints a counted pin can show. */
export interface GroupHintLabels {
	group: string;
	groupStacked: string;
	groupMany: string;
}

/** What clicking this counted pin will actually do. */
export function groupHint(group: ClubGroup, labels: GroupHintLabels): string {
	if (group.openZoom !== null) return labels.group;
	return group.clubs.length > SPREAD_MAX ? labels.groupMany : labels.groupStacked;
}

/**
 * Lays the members out on a ring around the point they share, sized so the pins
 * clear each other however many there are. Positions come back as coordinates
 * because that's what a map marker takes; they're only meaningful at the
 * zoom they were computed for, which is why this is redone on every regroup.
 */
function fanOut(clubs: MapClub[], anchor: Point, zoom: number): SpreadClub[] {
	const circumference = clubs.length * (PIN_SIZE + PIN_GAP);
	const radius = Math.max(SPREAD_MIN_RADIUS, circumference / (2 * Math.PI));

	return clubs.map((club, index) => {
		// Starting at twelve o'clock and going clockwise, so a pair reads as one
		// above the other rather than as an arbitrary diagonal.
		const angle = (2 * Math.PI * index) / clubs.length - Math.PI / 2;
		const point = { x: anchor.x + Math.cos(angle) * radius, y: anchor.y + Math.sin(angle) * radius };
		return { club, position: unproject(point, zoom) };
	});
}

/**
 * Clearance demanded when opening a group, as a multiple of the merge distance.
 * Grouping absorbs against a moving centroid, so members that are merely a pixel
 * past the merge distance can still chain back together; the margin makes the
 * group actually come apart rather than nearly come apart.
 */
const SEPARATION_SLACK = 1.35;

/**
 * The zoom at which every member of this group that *can* stand alone does.
 *
 * Fitting the group's bounds isn't enough: it frames the group, but a pair
 * sitting a few metres apart inside a group spread over a kilometre stays merged
 * at the fitting zoom, so opening the group still leaves an "N clubs here" pin
 * behind. Solving per pair instead — projected distance doubles per zoom level,
 * so the zoom a pair needs is a log away — and taking the deepest answer means
 * one click resolves the whole group.
 *
 * Pairs that would still collide at MAX_ZOOM are skipped rather than driving the
 * result: they can never be separated, so letting them set the zoom would only
 * bottom the map out. Null means no pair can be separated at all.
 */
function separationZoom(clubs: MapClub[]): number | null {
	const threshold = (PIN_SIZE + PIN_GAP) * SEPARATION_SLACK;
	const points = placeClubs(clubs, MAX_ZOOM).map((placed) => placed.point);

	let needed: number | null = null;
	for (let i = 0; i < points.length; i++) {
		for (let j = i + 1; j < points.length; j++) {
			const a = points[i];
			const b = points[j];
			const zoom = a && b ? pairSeparationZoom(a, b, threshold) : null;
			if (zoom !== null) needed = needed === null ? zoom : Math.max(needed, zoom);
		}
	}

	return needed;
}

/** The zoom that puts two points `threshold` pixels apart, or null if they never get there. */
function pairSeparationZoom(a: Point, b: Point, threshold: number): number | null {
	const spread = pixelDistance(a, b);
	if (spread === 0) return null;

	const zoom = MAX_ZOOM + Math.log2(threshold / spread);
	return zoom > MAX_ZOOM ? null : zoom;
}

function placeClubs(clubs: MapClub[], zoom: number): PlacedClub[] {
	const placed: PlacedClub[] = [];
	for (const club of clubs) {
		if (typeof club.latitude !== "number" || typeof club.longitude !== "number") continue;
		placed.push({ club, point: project([club.latitude, club.longitude], zoom) });
	}
	return placed;
}

/**
 * Collects every club that merges with the seed. The sweep repeats after every
 * absorption: the centroid moves, which can bring clubs that were just out of
 * range into it.
 */
function absorbNeighbours(
	seed: PlacedClub,
	placed: PlacedClub[],
	taken: Set<number>,
	threshold: number,
): { members: PlacedClub[]; centroid: Point } {
	const members: PlacedClub[] = [seed];
	let centroid = seed.point;

	let grew = true;
	while (grew) {
		grew = false;
		for (let j = 0; j < placed.length; j++) {
			const candidate = placed[j];
			if (!candidate || taken.has(j)) continue;
			if (pixelDistance(centroid, candidate.point) >= threshold) continue;

			taken.add(j);
			members.push(candidate);
			const n = members.length;
			centroid = {
				x: (centroid.x * (n - 1) + candidate.point.x) / n,
				y: (centroid.y * (n - 1) + candidate.point.y) / n,
			};
			grew = true;
		}
	}

	return { members, centroid };
}

function buildGroup(members: PlacedClub[], centroid: Point, zoom: number): ClubGroup {
	const memberClubs = members.map((m) => m.club);
	const openZoom = memberClubs.length > 1 ? separationZoom(memberClubs) : null;

	// Only a group no zoom can resolve gets fanned out, and only once the shared
	// point is unambiguous. Anything zooming can separate is left to zooming:
	// those clubs have their own coordinates and deserve to be drawn on them.
	const fannable =
		memberClubs.length > 1 && memberClubs.length <= SPREAD_MAX && openZoom === null && zoom >= SPREAD_ZOOM;

	return {
		key: memberClubs
			.map((c) => c.id)
			.sort()
			.join("|"),
		clubs: memberClubs,
		center: unproject(centroid, zoom),
		openZoom,
		spread: fannable ? fanOut(memberClubs, centroid, zoom) : null,
	};
}

/**
 * Groups by projected pixel distance at the given zoom. Projection is used
 * rather than container points so panning never reshuffles the groups — only
 * zooming does, which is what a viewer expects.
 */
export function groupClubs(clubs: MapClub[], zoom: number): ClubGroup[] {
	const threshold = pinSizeForZoom(zoom) + PIN_GAP;
	const placed = placeClubs(clubs, zoom);
	const taken = new Set<number>();
	const groups: ClubGroup[] = [];

	for (let i = 0; i < placed.length; i++) {
		const seed = placed[i];
		if (!seed || taken.has(i)) continue;

		taken.add(i);
		const { members, centroid } = absorbNeighbours(seed, placed, taken, threshold);
		groups.push(buildGroup(members, centroid, zoom));
	}

	return groups;
}

/*
 * Regrouping is a change of state, and the viewer has to be able to follow it.
 * Swapping the pins out in place tells them nothing: three logos become a "3",
 * or a "3" becomes three logos, and the only way to know which pins are which is
 * to work it out afterwards. So every pin that arrives comes *from* somewhere and
 * every pin that leaves goes *somewhere* — a merge collapses the members into the
 * count, a split throws the members back out of it, along the same paths.
 *
 * The motion is a translate on the pin's own wrapper rather than a move of the
 * marker, so Leaflet keeps owning the coordinates and the browser only ever
 * animates a transform.
 */

/** One pin as drawn: a counted group, a lone club, or one arm of a fan. */
export interface PinEntity {
	/** Matches the React key of the marker, so identity survives a regroup. */
	id: string;
	at: LatLng;
	clubs: MapClub[];
	group: boolean;
}

export type PinMotion = { kind: "enter" | "exit"; dx: number; dy: number; delay: number };

/** A pin that no longer exists, kept on screen just long enough to leave visibly. */
export interface PinGhost extends PinEntity {
	motion: PinMotion;
}

/**
 * A pin thrown further than this reads as a flight across the map rather than as
 * the same pin moving, so past it only the direction is kept. Motion that hints
 * where something went beats motion that has to be chased.
 */
const MOTION_MAX = 150;
/** Below this the pin has effectively not moved, and a translate would be noise. */
const MOTION_MIN = 1.5;
const MOTION_STAGGER = 22;
export const MOTION_STAGGER_MAX = 110;
/** Long enough for the exit to finish; the ghosts are unmounted after it. */
export const GHOST_LIFETIME = 340;

export function pinEntities(groups: ClubGroup[]): PinEntity[] {
	const entities: PinEntity[] = [];

	for (const group of groups) {
		if (group.spread) {
			for (const { club, position } of group.spread) {
				entities.push({ id: `${group.key}::${club.id}`, at: position, clubs: [club], group: false });
			}
			continue;
		}
		entities.push({ id: group.key, at: group.center, clubs: group.clubs, group: group.clubs.length > 1 });
	}

	return entities;
}

/**
 * How far `from` sits from `self` in screen pixels. Projected points are used
 * because their difference is the same wherever the map happens to be panned.
 */
function pixelOffset(zoom: number, from: LatLng, self: LatLng): { dx: number; dy: number } {
	const a = project(from, zoom);
	const b = project(self, zoom);
	const dx = a.x - b.x;
	const dy = a.y - b.y;

	const distance = Math.hypot(dx, dy);
	if (distance < MOTION_MIN) return { dx: 0, dy: 0 };

	const scale = distance > MOTION_MAX ? MOTION_MAX / distance : 1;
	return { dx: dx * scale, dy: dy * scale };
}

export interface Regrouping {
	enter: Map<string, PinMotion>;
	ghosts: PinGhost[];
}

/**
 * Pairs the pins before a regroup with the pins after it, by membership.
 *
 * A pin with exactly one counterpart moved, so it animates along the line
 * between the two: a member into the count that swallowed it, a count out into
 * each member it released. A pin with several counterparts is the join or the
 * split itself — nowhere single to come from or go to — so it scales in or out
 * where it stands and lets the other side carry the direction.
 */
export function planRegrouping(zoom: number, before: PinEntity[], after: PinEntity[]): Regrouping {
	const beforeByClub = indexByClub(before);
	const afterByClub = indexByClub(after);
	const beforeIds = new Set(before.map((entity) => entity.id));
	const afterIds = new Set(after.map((entity) => entity.id));

	// Pins leaving or arriving together are staggered in the order they were laid
	// out, so a fan opens as a sweep rather than as one lump.
	const counts = new Map<string, number>();
	const stagger = (key: string) => {
		const index = counts.get(key) ?? 0;
		counts.set(key, index + 1);
		return Math.min(index * MOTION_STAGGER, MOTION_STAGGER_MAX);
	};

	const enter = new Map<string, PinMotion>();
	for (const entity of after) {
		if (beforeIds.has(entity.id)) continue;

		const source = soleRelative(entity, beforeByClub);
		const offset = source ? pixelOffset(zoom, source.at, entity.at) : { dx: 0, dy: 0 };
		enter.set(entity.id, { kind: "enter", ...offset, delay: stagger(source ? `in:${source.id}` : "in") });
	}

	const ghosts: PinGhost[] = [];
	for (const entity of before) {
		if (afterIds.has(entity.id)) continue;

		const target = soleRelative(entity, afterByClub);
		const offset = target ? pixelOffset(zoom, target.at, entity.at) : { dx: 0, dy: 0 };
		ghosts.push({
			...entity,
			motion: { kind: "exit", ...offset, delay: stagger(target ? `out:${target.id}` : "out") },
		});
	}

	return { enter, ghosts };
}

function indexByClub(entities: PinEntity[]): Map<string, PinEntity> {
	const byClub = new Map<string, PinEntity>();
	for (const entity of entities) {
		for (const club of entity.clubs) byClub.set(club.id, entity);
	}
	return byClub;
}

/** The one pin in `lookup` that holds this pin's clubs, or undefined when there are none or several. */
function soleRelative(entity: PinEntity, lookup: Map<string, PinEntity>): PinEntity | undefined {
	const found = new Map<string, PinEntity>();
	for (const club of entity.clubs) {
		const match = lookup.get(club.id);
		if (match) found.set(match.id, match);
	}
	return found.size === 1 ? [...found.values()][0] : undefined;
}

/**
 * The pin's own transform-origin: a club pin grows out of its tip, a group out of
 * its middle, matching where each is anchored to the map.
 */
export function motionStyle(motion: PinMotion | undefined, group: boolean): CSSProperties {
	if (!motion) return {};

	return {
		"--map-dx": `${Math.round(motion.dx)}px`,
		"--map-dy": `${Math.round(motion.dy)}px`,
		animationDelay: `${motion.delay}ms`,
		transformOrigin: group ? "50% 50%" : "50% 100%",
	} as CSSProperties;
}

export function motionClass(motion: PinMotion | undefined): string {
	if (!motion) return "map-marker-in";
	return motion.kind === "enter" ? "map-marker-emerge" : "map-marker-vanish";
}
