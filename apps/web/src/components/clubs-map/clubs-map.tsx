"use client";

import { CircleMarker, MapContainer, Polyline, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Marker, type MarkerProps } from "@adamscybot/react-leaflet-component-marker";
import L from "leaflet";
import {
	ArrowUpRightIcon,
	Calendar,
	ChevronRight,
	Eye,
	EyeOff,
	Globe,
	Handshake,
	MailOpenIcon,
	MapPin,
	Navigation,
	Phone,
	Search,
	X,
} from "lucide-react";
import Image from "next/image";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { type CSSProperties, Fragment, useCallback, useEffect, useRef, useState } from "react";
import { InstagramIcon, VerifiedClubIcon } from "@/components/icons";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { bannerFallbackStyle } from "@/lib/identity";
import { cn } from "@/lib/utils";

// Minimal club type for map marker
export interface MapClub {
	id: string;
	name: string;
	latitude: number | null;
	longitude: number | null;
	location: string | null;
	logo: string | null;
	logoTile?: "paper" | "ink" | null;
	headerImage?: string | null;
	slug?: string | null;
	verified?: boolean;
	description?: string | null;
	isPrivate?: boolean;
	isAllied?: boolean;
	dateFounded?: string | null;
	website?: string | null;
	instagramUsername?: string | null;
	contactEmail?: string | null;
	contactPhone?: string | null;
}

// Custom TileLayer with LCP optimization
class OptimizedTileLayer extends L.TileLayer {
	private _isInitialLoad = true;

	override createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
		const tile = super.createTile(coords, done) as HTMLImageElement;

		// Apply fetchpriority=high to initial viewport tiles
		if (this._isInitialLoad && tile instanceof HTMLImageElement) {
			tile.setAttribute("fetchpriority", "high");
		}

		// Mark initial load as complete after first batch of tiles
		if (this._isInitialLoad) {
			setTimeout(() => {
				this._isInitialLoad = false;
			}, 100);
		}

		return tile;
	}
}

// Factory function to create optimized tile layer
const createOptimizedTileLayer = (url: string, options?: L.TileLayerOptions) => {
	return new OptimizedTileLayer(url, options);
};

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
const PIN_SIZE = 44; // Default plate, in pixels
const PIN_FAR_SIZE = 28; // Zoomed out, no inner frame
const PIN_SELECTED_SIZE = 56;
const PIN_GAP = 8; // Breathing room between two pins before they merge
const FAR_ZOOM = 9; // At or below this, pins drop to their small form
const MAX_ZOOM = 19; // As far in as the basemap goes, and the limit grouping is judged against

/**
 * Where fanning starts. The fan is measured in screen pixels, so it works at any
 * zoom — but at a country's worth of scale its arms would read as clubs sitting
 * kilometres apart. By this zoom the arms span roughly a block, which is close
 * enough to the truth for the leader lines to carry the rest.
 */
const SPREAD_ZOOM = 16;
/** Past this many, a ring of pins is worse than a list. */
const SPREAD_MAX = 12;
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

interface SpreadClub {
	club: MapClub;
	/** Where the pin is drawn — on the ring, not on the club's own coordinate. */
	position: [number, number];
}

interface ClubGroup {
	/** Stable across renders for the same membership, so markers aren't recreated. */
	key: string;
	clubs: MapClub[];
	center: [number, number];
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
	point: L.Point;
}

/** What clicking this counted pin will actually do. */
function groupHint(group: ClubGroup, labels: ClubIconLabels): string {
	if (group.openZoom !== null) return labels.group;
	return group.clubs.length > SPREAD_MAX ? labels.groupMany : labels.groupStacked;
}

/**
 * Lays the members out on a ring around the point they share, sized so the pins
 * clear each other however many there are. Positions come back as coordinates
 * because that's what a Leaflet marker takes; they're only meaningful at the
 * zoom they were computed for, which is why this is redone on every regroup.
 */
function fanOut(clubs: MapClub[], anchor: L.Point, zoom: number, map: L.Map): SpreadClub[] {
	const circumference = clubs.length * (PIN_SIZE + PIN_GAP);
	const radius = Math.max(SPREAD_MIN_RADIUS, circumference / (2 * Math.PI));

	return clubs.map((club, index) => {
		// Starting at twelve o'clock and going clockwise, so a pair reads as one
		// above the other rather than as an arbitrary diagonal.
		const angle = (2 * Math.PI * index) / clubs.length - Math.PI / 2;
		const point = anchor.add(new L.Point(Math.cos(angle) * radius, Math.sin(angle) * radius));
		const at = map.unproject(point, zoom);
		return { club, position: [at.lat, at.lng] as [number, number] };
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
function separationZoom(clubs: MapClub[], map: L.Map): number | null {
	const threshold = (PIN_SIZE + PIN_GAP) * SEPARATION_SLACK;
	const points: L.Point[] = [];

	for (const club of clubs) {
		if (typeof club.latitude !== "number" || typeof club.longitude !== "number") continue;
		points.push(map.project([club.latitude, club.longitude], MAX_ZOOM));
	}

	let needed: number | null = null;
	for (let i = 0; i < points.length; i++) {
		for (let j = i + 1; j < points.length; j++) {
			const a = points[i];
			const b = points[j];
			if (!a || !b) continue;

			const spread = a.distanceTo(b);
			if (spread === 0) continue;

			const zoom = MAX_ZOOM + Math.log2(threshold / spread);
			if (zoom > MAX_ZOOM) continue;

			needed = needed === null ? zoom : Math.max(needed, zoom);
		}
	}

	return needed;
}

/**
 * Groups by projected pixel distance at the current zoom. Projection is used
 * rather than container points so panning never reshuffles the groups — only
 * zooming does, which is what a viewer expects.
 */
function groupClubs(clubs: MapClub[], map: L.Map): ClubGroup[] {
	const zoom = map.getZoom();
	const threshold = pinSizeForZoom(zoom) + PIN_GAP;

	const placed: PlacedClub[] = [];
	for (const club of clubs) {
		if (typeof club.latitude !== "number" || typeof club.longitude !== "number") continue;
		placed.push({ club, point: map.project([club.latitude, club.longitude], zoom) });
	}

	const taken = new Set<number>();
	const groups: ClubGroup[] = [];

	for (let i = 0; i < placed.length; i++) {
		const seed = placed[i];
		if (!seed || taken.has(i)) continue;

		taken.add(i);
		const members: PlacedClub[] = [seed];
		let centroid = seed.point;

		// Re-sweep after every absorption: the centroid moves, which can bring
		// clubs that were just out of range into it.
		let grew = true;
		while (grew) {
			grew = false;
			for (let j = 0; j < placed.length; j++) {
				const candidate = placed[j];
				if (!candidate || taken.has(j)) continue;
				if (centroid.distanceTo(candidate.point) >= threshold) continue;

				taken.add(j);
				members.push(candidate);
				centroid = centroid
					.multiplyBy(members.length - 1)
					.add(candidate.point)
					.divideBy(members.length);
				grew = true;
			}
		}

		const center = map.unproject(centroid, zoom);
		const memberClubs = members.map((m) => m.club);
		const openZoom = memberClubs.length > 1 ? separationZoom(memberClubs, map) : null;

		// Only a group no zoom can resolve gets fanned out, and only once the shared
		// point is unambiguous. Anything zooming can separate is left to zooming:
		// those clubs have their own coordinates and deserve to be drawn on them.
		const fannable =
			memberClubs.length > 1 && memberClubs.length <= SPREAD_MAX && openZoom === null && zoom >= SPREAD_ZOOM;

		groups.push({
			key: memberClubs
				.map((c) => c.id)
				.sort()
				.join("|"),
			clubs: memberClubs,
			center: [center.lat, center.lng],
			openZoom,
			spread: fannable ? fanOut(memberClubs, centroid, zoom, map) : null,
		});
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
interface PinEntity {
	/** Matches the React key of the marker, so identity survives a regroup. */
	id: string;
	at: [number, number];
	clubs: MapClub[];
	group: boolean;
}

type PinMotion = { kind: "enter" | "exit"; dx: number; dy: number; delay: number };

/** A pin that no longer exists, kept on screen just long enough to leave visibly. */
interface PinGhost extends PinEntity {
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
const MOTION_STAGGER_MAX = 110;
/** Long enough for the exit to finish; the ghosts are unmounted after it. */
const GHOST_LIFETIME = 340;

function pinEntities(groups: ClubGroup[]): PinEntity[] {
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
 * How far `from` sits from `self` in screen pixels. Layer points are used because
 * their difference is the same wherever the map happens to be panned.
 */
function pixelOffset(map: L.Map, from: [number, number], self: [number, number]): { dx: number; dy: number } {
	const a = map.latLngToLayerPoint(from);
	const b = map.latLngToLayerPoint(self);
	const dx = a.x - b.x;
	const dy = a.y - b.y;

	const distance = Math.hypot(dx, dy);
	if (distance < MOTION_MIN) return { dx: 0, dy: 0 };

	const scale = distance > MOTION_MAX ? MOTION_MAX / distance : 1;
	return { dx: dx * scale, dy: dy * scale };
}

interface Regrouping {
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
function planRegrouping(map: L.Map, before: PinEntity[], after: PinEntity[]): Regrouping {
	const beforeByClub = new Map<string, PinEntity>();
	for (const entity of before) {
		for (const club of entity.clubs) beforeByClub.set(club.id, entity);
	}
	const afterByClub = new Map<string, PinEntity>();
	for (const entity of after) {
		for (const club of entity.clubs) afterByClub.set(club.id, entity);
	}

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

	const relatives = (entity: PinEntity, lookup: Map<string, PinEntity>) => {
		const found = new Map<string, PinEntity>();
		for (const club of entity.clubs) {
			const match = lookup.get(club.id);
			if (match) found.set(match.id, match);
		}
		return [...found.values()];
	};

	const enter = new Map<string, PinMotion>();
	for (const entity of after) {
		if (beforeIds.has(entity.id)) continue;

		const sources = relatives(entity, beforeByClub);
		const source = sources.length === 1 ? sources[0] : undefined;
		const offset = source ? pixelOffset(map, source.at, entity.at) : { dx: 0, dy: 0 };
		enter.set(entity.id, { kind: "enter", ...offset, delay: stagger(source ? `in:${source.id}` : "in") });
	}

	const ghosts: PinGhost[] = [];
	for (const entity of before) {
		if (afterIds.has(entity.id)) continue;

		const targets = relatives(entity, afterByClub);
		const target = targets.length === 1 ? targets[0] : undefined;
		const offset = target ? pixelOffset(map, target.at, entity.at) : { dx: 0, dy: 0 };
		ghosts.push({
			...entity,
			motion: { kind: "exit", ...offset, delay: stagger(target ? `out:${target.id}` : "out") },
		});
	}

	return { enter, ghosts };
}

/**
 * The pin's own transform-origin: a club pin grows out of its tip, a group out of
 * its middle, matching where each is anchored to the map.
 */
function motionStyle(motion: PinMotion | undefined, group: boolean): CSSProperties {
	if (!motion) return {};

	return {
		"--map-dx": `${Math.round(motion.dx)}px`,
		"--map-dy": `${Math.round(motion.dy)}px`,
		animationDelay: `${motion.delay}ms`,
		transformOrigin: group ? "50% 50%" : "50% 100%",
	} as CSSProperties;
}

function motionClass(motion: PinMotion | undefined): string {
	if (!motion) return "map-marker-in";
	return motion.kind === "enter" ? "map-marker-emerge" : "map-marker-vanish";
}

// React component for optimized tile layer
function OptimizedTileLayerComponent({ url, ...options }: { url: string } & L.TileLayerOptions) {
	const map = useMap();

	useEffect(() => {
		const tileLayer = createOptimizedTileLayer(url, options);
		map.addLayer(tileLayer);

		return () => {
			map.removeLayer(tileLayer);
		};
	}, [map, url, options]);

	return null;
}

// Pre-translated strings for the pins: they render outside the React tree (leaflet
// divIcon), and the next-intl extractor only picks up t() calls made directly in the
// component that owns useExtracted(), not through a passed-down t.
interface ClubIconLabels {
	clubLocation: string;
	group: string;
	groupStacked: string;
	groupMany: string;
}

const PIN_SHADOW = "drop-shadow(0 3px 6px rgba(27,26,24,0.22)) drop-shadow(0 1px 1px rgba(27,26,24,0.14))";
const PIN_SHADOW_RAISED = "drop-shadow(0 8px 14px rgba(27,26,24,0.26)) drop-shadow(0 2px 3px rgba(27,26,24,0.16))";
const PLATE = "#ffffff";
const PLATE_SELECTED = "#b6221f";
const PLATE_STACK = "#faf8f4";
const PLATE_STACK_BORDER = "#e4e0d8";
const GROUP_PLATE = "#1b1a18";
const GROUP_INK = "#f4f2ee";

/**
 * The tether from a fanned pin back to the coordinate it really occupies. Thin
 * and quiet: it has to be readable as "this pin belongs to that dot" without
 * competing with the pins it's explaining.
 */
const SPREAD_LEADER: L.PathOptions = { color: GROUP_PLATE, weight: 1.5, opacity: 0.35 };
/** The shared coordinate itself, so the lines converge on something. */
const SPREAD_ANCHOR: L.PathOptions = {
	color: PLATE,
	weight: 2,
	opacity: 0.9,
	fillColor: GROUP_PLATE,
	fillOpacity: 0.9,
};

// Fixed geometry, drawn once. State only ever changes `transform`, so a pin can
// grow, shrink or be grabbed mid-flight without the browser re-laying anything out.
const PLATE_PAD = 3;
const PLATE_RADIUS = 12;
const TIP = 12;
/** How far the rotated tip square reaches below the plate: (TIP·√2 − TIP)/2 + TIP/3. */
const TIP_OVERHANG = Math.round((TIP * Math.SQRT2 - TIP) / 2 + TIP / 3);
const PIN_BOX_H = PIN_SIZE + TIP_OVERHANG;

const SCALE_FAR = PIN_FAR_SIZE / PIN_SIZE;
const SCALE_HOVER = 1.08;
const SCALE_SELECTED = PIN_SELECTED_SIZE / PIN_SIZE;

type IconOpts = NonNullable<MarkerProps["componentIconOpts"]>;

/**
 * A club pin's anchor is the point of its tip, not the middle of its plate, so
 * growing on select or on zoom lifts the plate off a fixed spot instead of
 * sliding the whole pin down the map.
 */
const CLUB_ICON_OPTS: IconOpts = {
	layoutMode: "fit-parent",
	rootDivOpts: { iconSize: [PIN_SIZE, PIN_BOX_H], iconAnchor: [PIN_SIZE / 2, PIN_BOX_H], className: "map-marker" },
};

/** A group has no tip, so it stays centred on its centroid. */
const GROUP_ICON_OPTS: IconOpts = {
	layoutMode: "fit-parent",
	rootDivOpts: { iconSize: [PIN_SIZE, PIN_SIZE], iconAnchor: [PIN_SIZE / 2, PIN_SIZE / 2], className: "map-marker" },
};

type PinState = "default" | "hovered" | "selected";

function pinScale(state: PinState, far: boolean): number {
	if (state === "selected") {
		return SCALE_SELECTED;
	}
	if (state === "hovered") {
		return far ? SCALE_FAR * 1.18 : SCALE_HOVER;
	}
	return far ? SCALE_FAR : 1;
}

function plateBody(background: string): CSSProperties {
	return {
		position: "absolute",
		left: 0,
		top: 0,
		width: PIN_SIZE,
		height: PIN_SIZE,
		borderRadius: PLATE_RADIUS,
		background,
		boxSizing: "border-box",
	};
}

/**
 * The plate is what makes a logo legible on a busy basemap: a club's mark never
 * touches the map itself, it sits on paper. Zoomed out the inner frame closes —
 * at 28px a 3px border is just mud — and it reopens on the way back in.
 */
function ClubPin({
	club,
	state,
	far,
	labels,
	motion,
}: {
	club: Pick<MapClub, "name" | "logo" | "logoTile">;
	state: PinState;
	far: boolean;
	labels: ClubIconLabels;
	motion?: PinMotion;
}) {
	const selected = state === "selected";
	const raised = selected || state === "hovered";
	const plate = selected ? PLATE_SELECTED : PLATE;
	const pad = far && !selected ? 0 : PLATE_PAD;

	return (
		<div
			className={motionClass(motion)}
			style={{ position: "relative", width: "100%", height: "100%", ...motionStyle(motion, false) }}
		>
			<div
				className={cn("map-pin", selected && "map-pin-settling")}
				style={{
					position: "absolute",
					left: 0,
					bottom: TIP_OVERHANG,
					width: PIN_SIZE,
					height: PIN_SIZE,
					// The origin is the tip's point, so every scale grows out of the
					// exact coordinate the pin marks.
					transformOrigin: `50% ${PIN_SIZE + TIP_OVERHANG}px`,
					transform: `scale(${pinScale(state, far)})`,
					filter: raised ? PIN_SHADOW_RAISED : PIN_SHADOW,
				}}
			>
				{/* A rotated square rather than a triangle, so the tip keeps the plate's corner radius. */}
				<div
					className="map-pin-plate"
					style={{
						position: "absolute",
						left: "50%",
						bottom: -Math.round(TIP / 3),
						marginLeft: -TIP / 2,
						width: TIP,
						height: TIP,
						background: plate,
						borderRadius: 2,
						transform: "rotate(45deg)",
					}}
				/>
				<div
					className="map-pin-plate"
					style={{ ...plateBody(plate), position: "relative", padding: pad }}
					title={club.name || labels.clubLocation}
				>
					<ClubAvatar
						name={club.name}
						logo={club.logo}
						tile={club.logoTile}
						size={PIN_SIZE - PLATE_PAD * 2}
						fill
					/>
				</div>
			</div>
			{state === "hovered" && club.name && (
				<div
					className="map-pin-label"
					style={{
						position: "absolute",
						top: "100%",
						marginTop: 6,
						left: "50%",
						padding: "4px 8px",
						borderRadius: 6,
						background: GROUP_PLATE,
						color: GROUP_INK,
						fontSize: 12,
						lineHeight: 1.2,
						whiteSpace: "nowrap",
						zIndex: 50,
					}}
				>
					{club.name}
				</div>
			)}
		</div>
	);
}

/**
 * Stacked plates say "more than one" before the number is even read — the count
 * confirms it rather than carrying the whole message on its own.
 */
function GroupPin({
	count,
	far,
	hovered,
	hint,
	motion,
}: {
	count: number;
	far: boolean;
	hovered: boolean;
	hint: string;
	motion?: PinMotion;
}) {
	const stack: CSSProperties = {
		...plateBody(PLATE_STACK),
		border: `1px solid ${PLATE_STACK_BORDER}`,
	};

	return (
		<div
			className={motionClass(motion)}
			style={{ position: "relative", width: "100%", height: "100%", ...motionStyle(motion, true) }}
		>
			<div
				className="map-pin"
				style={{
					position: "absolute",
					inset: 0,
					transformOrigin: "50% 50%",
					transform: `scale(${pinScale(hovered ? "hovered" : "default", far)})`,
					filter: hovered ? PIN_SHADOW_RAISED : PIN_SHADOW,
				}}
				title={hint}
			>
				<div style={{ ...stack, left: PIN_SIZE * 0.114, top: PIN_SIZE * -0.114, opacity: 0.55 }} />
				<div style={{ ...stack, left: PIN_SIZE * 0.057, top: PIN_SIZE * -0.057, opacity: 0.8 }} />
				<div
					style={{
						...plateBody(GROUP_PLATE),
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: GROUP_INK,
						fontFamily: "var(--font-club-mark)",
						fontWeight: 700,
						fontSize: Math.round(PIN_SIZE * 0.4),
						lineHeight: 1,
						userSelect: "none",
					}}
				>
					{count}
				</div>
			</div>
		</div>
	);
}

interface MapFocusPoint {
	lat: number;
	lng: number;
	zoom?: number;
}

interface ClubsMapProps {
	clubs: MapClub[];
	onLocationSelect?: (lat: number, lng: number) => void;
	interactive?: boolean;
	focusPoint?: MapFocusPoint | null;
	controlsBelowHeader?: boolean;
}

function LocationMarker({
	position,
	name,
	logo,
	tile,
	labels,
}: {
	position: [number, number];
	name?: string;
	logo?: string | null;
	tile?: MapClub["logoTile"];
	labels: ClubIconLabels;
}) {
	return position ? (
		<Marker
			position={position}
			componentIconOpts={CLUB_ICON_OPTS}
			icon={
				<ClubPin
					club={{ name: name ?? "", logo: logo ?? null, logoTile: tile ?? null }}
					state="default"
					far={false}
					labels={labels}
				/>
			}
		/>
	) : null;
}

function MapEventHandler({ onLocationSelect }: { onLocationSelect?: (lat: number, lng: number) => void }) {
	useMapEvents({
		// biome-ignore lint/suspicious/noExplicitAny: Dynamic map data
		click: (e: any) => {
			if (onLocationSelect) {
				onLocationSelect(e.latlng.lat, e.latlng.lng);
			}
		},
	});
	return null;
}

/**
 * Clicking the basemap clears the selection. Leaflet only fires `click` on the
 * map when nothing interactive was hit, so a pin click never reaches this.
 */
function MapBackgroundDeselect({ onDeselect }: { onDeselect: () => void }) {
	useMapEvents({ click: onDeselect });
	return null;
}

function MapController({ targetClub, focusPoint }: { targetClub: MapClub | null; focusPoint?: MapFocusPoint | null }) {
	const map = useMap();
	const focusLat = focusPoint?.lat;
	const focusLng = focusPoint?.lng;
	const focusZoom = focusPoint?.zoom;

	useEffect(() => {
		if (targetClub?.latitude && targetClub?.longitude) {
			map.flyTo([targetClub.latitude, targetClub.longitude], 16, {
				duration: 1.5,
			});
			return;
		}

		if (typeof focusLat === "number" && typeof focusLng === "number") {
			map.flyTo([focusLat, focusLng], focusZoom || 12, {
				duration: 1.5,
			});
		}
	}, [targetClub, focusLat, focusLng, focusZoom, map]);

	return null;
}

/**
 * What the map has open. A group that zooming can't resolve opens as a list
 * rather than a single club, so a shared pin never hides the clubs behind it.
 */
type MapSelection = { kind: "club"; club: MapClub } | { kind: "group"; key: string; clubs: MapClub[] };

/** The point the map should keep in view for the current selection. */
function selectionCenter(selection: MapSelection): [number, number] | null {
	const clubs = selection.kind === "club" ? [selection.club] : selection.clubs;
	for (const club of clubs) {
		if (typeof club.latitude === "number" && typeof club.longitude === "number") {
			return [club.latitude, club.longitude];
		}
	}
	return null;
}

function directionsUrl(club: MapClub): string | null {
	if (typeof club.latitude !== "number" || typeof club.longitude !== "number") return null;
	return `https://www.google.com/maps/dir/?api=1&destination=${club.latitude},${club.longitude}`;
}

/**
 * A club's banner, at panel scale. Without an upload the hashed field colour
 * fills the band, so every card has the same silhouette whether or not the club
 * ever got round to uploading a header.
 */
function CardBanner({ club }: { club: MapClub }) {
	return (
		<div
			className="relative h-24 w-full overflow-hidden rounded-t-[7px]"
			style={club.headerImage ? undefined : bannerFallbackStyle(club.name, "club")}
		>
			{club.headerImage && (
				<Image
					suppressHydrationWarning
					src={club.headerImage}
					alt=""
					fill
					draggable={false}
					sizes="360px"
					className="object-cover"
				/>
			)}
			{/*
			 * A bottom scrim sits under the mark. Without an upload the banner and the
			 * mark hash from the same name and land on the same colour, so the ring
			 * alone isn't enough to separate them.
			 */}
			<div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-[rgba(27,26,24,0.6)] to-transparent" />
		</div>
	);
}

/**
 * Everything a viewer needs to decide whether to keep looking, without leaving
 * the map: who the club is, where, and every way to reach them.
 */
function ClubDetailCard({ club }: { club: MapClub }) {
	const t = useExtracted();
	const directions = directionsUrl(club);
	const instagram = club.instagramUsername && !club.website?.includes("instagram.com");

	return (
		<>
			<CardBanner club={club} />

			<div className="flex flex-col gap-3 p-4 pt-0">
				{/*
				 * The mark overhangs the banner, matching the club page's header. It needs
				 * `relative` to do that: the banner is positioned, so it paints over a
				 * static sibling no matter which comes first in the DOM.
				 */}
				<div className="relative z-1 -mt-7 w-fit rounded-[16px] bg-background p-1 shadow-md">
					<ClubAvatar name={club.name} logo={club.logo} tile={club.logoTile} size={56} radius={12} />
				</div>

				<div className="flex flex-col gap-0.5">
					<div className="flex items-center gap-2">
						<h3 className="truncate font-semibold text-lg">{club.name}</h3>
						{club.verified && <VerifiedClubIcon />}
					</div>
					{club.location && (
						<p className="flex items-center gap-1.5 text-muted-foreground text-sm">
							<MapPin className="size-3.5 shrink-0" />
							<span className="truncate">{club.location}</span>
						</p>
					)}
				</div>

				{club.description && <p className="line-clamp-3 text-foreground text-sm">{club.description}</p>}

				<div className="flex flex-wrap gap-1.5">
					<Badge variant="secondary" className="flex items-center gap-1">
						{club.isPrivate ? (
							<>
								<EyeOff className="size-3" />
								{t("Private")}
							</>
						) : (
							<>
								<Eye className="size-3" />
								{t("Public")}
							</>
						)}
					</Badge>
					{club.isAllied && (
						<Badge variant="secondary" className="flex items-center gap-1">
							<Handshake className="size-3" />
							{t("ASK FBIH")}
						</Badge>
					)}
					{club.dateFounded && (
						<Badge variant="secondary" className="flex items-center gap-1">
							<Calendar className="size-3" />
							{t("Founded")} {new Date(club.dateFounded).getFullYear()}
						</Badge>
					)}
				</div>

				<div className="grid grid-cols-2 gap-2">
					{club.website && (
						<Button variant="outline" size="sm" asChild>
							<Link href={club.website} target="_blank" rel="noopener noreferrer">
								<Globe />
								{t("Website")}
							</Link>
						</Button>
					)}
					{instagram && (
						<Button variant="outline" size="sm" asChild>
							<Link
								href={`https://instagram.com/${club.instagramUsername}`}
								target="_blank"
								rel="noopener noreferrer"
							>
								<InstagramIcon />
								{t("Instagram")}
							</Link>
						</Button>
					)}
					{club.contactEmail && (
						<Button variant="outline" size="sm" asChild>
							<Link href={`mailto:${club.contactEmail}`}>
								<MailOpenIcon />
								{t("Email")}
							</Link>
						</Button>
					)}
					{club.contactPhone && (
						<Button variant="outline" size="sm" asChild>
							<Link href={`tel:${club.contactPhone}`}>
								<Phone />
								{t("Call")}
							</Link>
						</Button>
					)}
					{directions && (
						<Button variant="outline" size="sm" asChild>
							<Link href={directions} target="_blank" rel="noopener noreferrer">
								<Navigation />
								{t("Directions")}
							</Link>
						</Button>
					)}
				</div>

				<Button className="w-full" size="sm" asChild>
					<Link href={`/clubs/${club.slug || club.id}`} target="_blank">
						{t("View Club")}
						<ArrowUpRightIcon />
					</Link>
				</Button>
			</div>
		</>
	);
}

/**
 * The answer to a pin that can't be split: the clubs sharing that coordinate,
 * listed, each one a step into its own card.
 */
function GroupClubList({ clubs, onSelect }: { clubs: MapClub[]; onSelect: (club: MapClub) => void }) {
	const t = useExtracted();
	const location = clubs.find((club) => club.location)?.location;

	return (
		<div className="flex flex-col gap-3 p-4">
			<div className="flex flex-col gap-0.5 pr-8">
				<h3 className="font-semibold text-lg">{t("{count} clubs here", { count: clubs.length.toString() })}</h3>
				<p className="text-muted-foreground text-sm">{location ?? t("These clubs share the same location")}</p>
			</div>

			<div className="-mx-1 flex max-h-[45dvh] flex-col gap-0.5 overflow-y-auto md:max-h-72">
				{clubs.map((club) => (
					<button
						key={club.id}
						type="button"
						onClick={() => onSelect(club)}
						className="flex touch-manipulation items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted"
					>
						<ClubAvatar
							name={club.name}
							logo={club.logo}
							tile={club.logoTile}
							size={36}
							className="shrink-0"
						/>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-1.5">
								<span className="truncate font-medium">{club.name}</span>
								{club.verified && <VerifiedClubIcon />}
							</div>
							{club.location && (
								<div className="truncate text-muted-foreground text-sm">{club.location}</div>
							)}
						</div>
						<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
					</button>
				))}
			</div>
		</div>
	);
}

function SelectionBody({ selection, onSelect }: { selection: MapSelection; onSelect: (club: MapClub) => void }) {
	if (selection.kind === "group") {
		return <GroupClubList clubs={selection.clubs} onSelect={onSelect} />;
	}
	return <ClubDetailCard club={selection.club} />;
}

function ClubResultRow({ club, onSelect }: { club: MapClub; onSelect: (club: MapClub) => void }) {
	return (
		<button
			type="button"
			className="flex w-full touch-manipulation items-center gap-2 rounded px-3 py-2 text-left transition-colors hover:bg-muted"
			onClick={() => onSelect(club)}
		>
			<ClubAvatar name={club.name} logo={club.logo} tile={club.logoTile} size={28} className="shrink-0" />
			<div className="min-w-0 flex-1">
				<div className="truncate font-medium">{club.name}</div>
				{club.location && <div className="truncate text-muted-foreground text-sm">{club.location}</div>}
			</div>
		</button>
	);
}

function MapInstanceCapturer({ onMapReady }: { onMapReady: (map: L.Map) => void }) {
	const map = useMap();

	useEffect(() => {
		onMapReady(map);
	}, [map, onMapReady]);

	return null;
}

export function ClubsMap({
	clubs,
	onLocationSelect,
	interactive = false,
	focusPoint,
	controlsBelowHeader = false,
}: ClubsMapProps) {
	const [mounted, setMounted] = useState(false);
	const [clubId] = useQueryState("clubId");
	const [hoveredKey, setHoveredKey] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [targetClub, setTargetClub] = useState<MapClub | null>(null);
	const [groups, setGroups] = useState<ClubGroup[]>([]);
	const [far, setFar] = useState(false);
	const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
	const [selection, setSelection] = useState<MapSelection | null>(null);
	const [headerHeight, setHeaderHeight] = useState(56);
	const [enterMotion, setEnterMotion] = useState<Map<string, PinMotion>>(() => new Map());
	const [ghosts, setGhosts] = useState<PinGhost[]>([]);
	const lastEntities = useRef<PinEntity[] | null>(null);
	const ghostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const sheetRef = useRef<HTMLDivElement | null>(null);
	const t = useExtracted();
	const iconLabels: ClubIconLabels = {
		clubLocation: t("Club location"),
		group: t("Several clubs here — click to zoom in"),
		groupStacked: t("Several clubs at this exact spot — click to spread them out"),
		groupMany: t("Several clubs at this exact spot — click to list them"),
	};

	// The null guard matters: without it a missing `clubId` matches the first club
	// that happens to have no slug, and the map silently opens on that club.
	const prefilledClub = clubId ? clubs.find((club) => club.id === clubId || club.slug === clubId) : undefined;

	const defaultCenter: [number, number] = focusPoint
		? [focusPoint.lat, focusPoint.lng]
		: [prefilledClub?.latitude || 43.8563, prefilledClub?.longitude || 18.4131];
	const defaultZoom = focusPoint?.zoom || (prefilledClub ? 14 : 8);

	const filteredClubs = clubs.filter(
		(club) =>
			searchQuery === "" ||
			club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			club.location?.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	useEffect(() => {
		setMounted(true);
	}, []);

	// The site header wraps to two rows on narrow screens, so how far down the
	// controls have to start is something only the header itself knows.
	useEffect(() => {
		if (!controlsBelowHeader) return;

		const header = document.querySelector("header");
		if (!header) return;

		const measure = () => setHeaderHeight(header.getBoundingClientRect().height);
		measure();

		const observer = new ResizeObserver(measure);
		observer.observe(header);

		return () => observer.disconnect();
	}, [controlsBelowHeader]);

	// Regroup on zoom. Panning is deliberately not a trigger: groups are computed
	// in projected space, so they're identical wherever the viewport sits.
	useEffect(() => {
		if (!mapInstance || !clubs.length) return;

		const regroup = () => {
			const next = groupClubs(clubs, mapInstance);
			const entities = pinEntities(next);
			const previous = lastEntities.current;
			lastEntities.current = entities;

			setGroups(next);
			setFar(mapInstance.getZoom() <= FAR_ZOOM);

			// Zooming can redraw a group's membership. A list left open for a group
			// that no longer exists describes nothing on screen, so it closes.
			setSelection((current) =>
				current?.kind === "group" && !next.some((group) => group.key === current.key) ? null : current,
			);

			// The first layout has nothing to have come from, so its pins just appear.
			if (!previous) return;

			const { enter, ghosts: leaving } = planRegrouping(mapInstance, previous, entities);
			setEnterMotion(enter);
			setGhosts(leaving);

			if (ghostTimer.current) clearTimeout(ghostTimer.current);
			if (leaving.length > 0) {
				ghostTimer.current = setTimeout(() => setGhosts([]), GHOST_LIFETIME + MOTION_STAGGER_MAX);
			}
		};

		regroup();
		mapInstance.on("zoomend", regroup);

		return () => {
			mapInstance.off("zoomend", regroup);
			if (ghostTimer.current) clearTimeout(ghostTimer.current);
		};
	}, [mapInstance, clubs]);

	const deselect = useCallback(() => setSelection(null), []);

	/**
	 * A group that zooming can pull apart opens by flying in far enough that its
	 * members become individual pins — the map itself answers "which ones", and
	 * the logos separate on the way in. Fitting the group's bounds would only
	 * frame it: a tight pair inside a wide group survives the fit and you land on
	 * another "N clubs here", so the flight targets the separating zoom instead.
	 *
	 * A group no zoom can resolve (clubs pinned to the same town centre, most
	 * often) instead flies to the zoom where it fans out into a ring, which is
	 * the same promise kept a different way: click the number, get the logos.
	 * Only a group too big to make a legible ring falls back to a list.
	 */
	const openGroup = useCallback(
		(group: ClubGroup) => {
			if (!mapInstance) return;

			const points: [number, number][] = [];
			for (const club of group.clubs) {
				if (typeof club.latitude === "number" && typeof club.longitude === "number") {
					points.push([club.latitude, club.longitude]);
				}
			}
			if (points.length === 0) return;

			if (group.openZoom === null) {
				if (group.clubs.length > SPREAD_MAX) {
					setSelection({ kind: "group", key: group.key, clubs: group.clubs });
					return;
				}

				mapInstance.flyTo(group.center, Math.max(SPREAD_ZOOM, mapInstance.getZoom()), { duration: 1 });
				return;
			}

			// Centred on the group's bounds rather than its pin, so the members that
			// do fit at the separating zoom are the ones on screen.
			const bounds = L.latLngBounds(points);
			mapInstance.flyTo(bounds.getCenter(), Math.min(MAX_ZOOM, group.openZoom), { duration: 1 });
		},
		[mapInstance],
	);

	const selectClub = useCallback((club: MapClub) => setSelection({ kind: "club", club }), []);

	/** Search jumps the map as well as opening the card. */
	const selectFromSearch = useCallback((club: MapClub) => {
		setTargetClub(club);
		setSelection({ kind: "club", club });
		setSearchQuery("");
	}, []);

	// Escape is the other way out of a selection, so the overview never feels
	// like something you're stuck inside.
	useEffect(() => {
		if (!selection) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") deselect();
		};
		window.addEventListener("keydown", onKeyDown);

		return () => window.removeEventListener("keydown", onKeyDown);
	}, [selection, deselect]);

	// On a phone the card is a sheet over the bottom of the map, which is exactly
	// where a tapped pin tends to sit. Nudge the map so whatever the card is about
	// stays visible above it. Keyed on the coordinate rather than the selection
	// object, so re-rendering the same card doesn't fight the viewer's panning.
	const selectionAt = selection ? selectionCenter(selection) : null;
	const selectionLat = selectionAt?.[0];
	const selectionLng = selectionAt?.[1];
	useEffect(() => {
		if (!mapInstance || selectionLat === undefined || selectionLng === undefined) return;
		if (window.matchMedia("(min-width: 768px)").matches) return;

		// One frame, so the sheet has been laid out and can be measured.
		const frame = requestAnimationFrame(() => {
			const sheetHeight = sheetRef.current?.offsetHeight ?? 0;
			mapInstance.panInside(L.latLng(selectionLat, selectionLng), {
				// Clear of the header and the search pill sitting under it.
				paddingTopLeft: [24, headerHeight + 80],
				paddingBottomRight: [24, sheetHeight + 24],
				animate: true,
				duration: 0.4,
			});
		});

		return () => cancelAnimationFrame(frame);
	}, [mapInstance, selectionLat, selectionLng, headerHeight]);

	if (!mounted) {
		return null;
	}

	const selectedLocation =
		clubs?.[0]?.latitude && clubs[0]?.longitude
			? ([clubs[0].latitude, clubs[0].longitude] as [number, number])
			: null;

	const controlsTopInset = "top-[var(--map-top-inset)]";

	return (
		<div
			className={cn(
				"relative h-full w-full [&_.leaflet-top]:top-[var(--map-top-inset)]",
				// The header's height is measured rather than assumed: it wraps to two
				// rows on narrow screens, and a hardcoded inset tucked the search field
				// underneath it there.
			)}
			style={{ "--map-top-inset": `calc(${controlsBelowHeader ? headerHeight : 0}px + 1rem)` } as CSSProperties}
		>
			{!interactive && (
				<>
					{/*
					 * Desktop: search parked top-left, the card top-right, both out of the
					 * way of the middle of the map where the pins are.
					 */}
					<div className={cn("absolute left-4 z-[1200] hidden w-80 md:block", controlsTopInset)}>
						<div className="rounded-md border bg-background p-3 shadow-lg">
							<div className="relative">
								<Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
								<Input
									placeholder={t("Search clubs...")}
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									onKeyDown={(e) => {
										const first = filteredClubs[0];
										if (e.key === "Enter" && first) selectFromSearch(first);
									}}
									className="pr-4 pl-10"
								/>
							</div>

							{searchQuery && (
								<div className="mt-2 max-h-64 overflow-y-auto border-t pt-2">
									{filteredClubs.length > 0 ? (
										filteredClubs.map((club) => (
											<ClubResultRow key={club.id} club={club} onSelect={selectFromSearch} />
										))
									) : (
										<div className="px-3 py-2 text-center text-muted-foreground text-sm">
											{t("No clubs found")}
										</div>
									)}
								</div>
							)}
						</div>
					</div>

					{selection && (
						<div className={cn("absolute right-4 z-[1200] hidden w-80 md:block", controlsTopInset)}>
							<div className="relative overflow-hidden rounded-md border bg-background shadow-lg">
								<Button
									variant="secondary"
									size="sm"
									aria-label={t("Close")}
									className="absolute top-2 right-2 z-1 size-7 rounded-full p-0 shadow-sm"
									onClick={deselect}
								>
									<X className="size-4" />
								</Button>
								<SelectionBody selection={selection} onSelect={selectClub} />
							</div>
						</div>
					)}

					{/*
					 * Phone: search is a pill at the top and the selection is a sheet at the
					 * bottom, so the two never stack on top of each other and the sheet lands
					 * under the thumb. The middle of the screen stays map.
					 */}
					<div className={cn("absolute right-3 left-3 z-[1200] md:hidden", controlsTopInset)}>
						<div className="rounded-full border bg-background shadow-lg">
							<div className="relative">
								<Search className="-translate-y-1/2 absolute top-1/2 left-4 size-4 text-muted-foreground" />
								<Input
									placeholder={t("Search clubs...")}
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									onKeyDown={(e) => {
										const first = filteredClubs[0];
										if (e.key === "Enter" && first) {
											selectFromSearch(first);
											e.currentTarget.blur();
										}
									}}
									className="h-11 rounded-full border-0 pr-10 pl-11 shadow-none focus-visible:ring-0"
								/>
								{searchQuery && (
									<button
										type="button"
										aria-label={t("Clear search")}
										onClick={() => setSearchQuery("")}
										className="-translate-y-1/2 absolute top-1/2 right-3 rounded-full p-1 text-muted-foreground"
									>
										<X className="size-4" />
									</button>
								)}
							</div>
						</div>

						{searchQuery && (
							<div className="mt-2 max-h-[45dvh] overflow-y-auto rounded-2xl border bg-background p-1 shadow-lg">
								{filteredClubs.length > 0 ? (
									filteredClubs
										.slice(0, 12)
										.map((club) => (
											<ClubResultRow key={club.id} club={club} onSelect={selectFromSearch} />
										))
								) : (
									<div className="px-3 py-3 text-center text-muted-foreground text-sm">
										{t("No clubs found")}
									</div>
								)}
							</div>
						)}
					</div>

					{selection && (
						<div
							ref={sheetRef}
							className="map-sheet absolute inset-x-0 bottom-0 z-[1200] max-h-[75dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_24px_rgba(27,26,24,0.18)] md:hidden"
						>
							{/* A grabber reads as "this panel is the front layer", even though it's the close button that dismisses it. */}
							<div className="sticky top-0 z-1 flex justify-center bg-background pt-2 pb-1">
								<div className="h-1 w-10 rounded-full bg-border" />
							</div>
							<Button
								variant="secondary"
								size="sm"
								aria-label={t("Close")}
								className="absolute top-3 right-3 z-2 size-8 rounded-full p-0 shadow-sm"
								onClick={deselect}
							>
								<X className="size-4" />
							</Button>
							<SelectionBody selection={selection} onSelect={selectClub} />
						</div>
					)}
				</>
			)}

			<MapContainer
				center={defaultCenter}
				zoom={defaultZoom}
				className="h-full w-full z-0"
				zoomControl={false}
				maxZoom={MAX_ZOOM}
				zoomSnap={0.1}
				zoomDelta={0.25}
				wheelPxPerZoomLevel={120}
				wheelDebounceTime={40}
			>
				<OptimizedTileLayerComponent
					url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
					maxZoom={MAX_ZOOM}
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
				/>

				<MapInstanceCapturer onMapReady={setMapInstance} />
				<MapController targetClub={targetClub} focusPoint={focusPoint} />

				{interactive ? (
					<MapEventHandler onLocationSelect={onLocationSelect} />
				) : (
					<MapBackgroundDeselect onDeselect={deselect} />
				)}

				{interactive && selectedLocation && (
					<LocationMarker
						position={selectedLocation}
						name={clubs?.[0]?.name}
						logo={clubs?.[0]?.logo}
						tile={clubs?.[0]?.logoTile}
						labels={iconLabels}
					/>
				)}

				{!interactive &&
					groups.map((group) => {
						const hovered = hoveredKey === group.key;
						const first = group.clubs[0];
						if (!first) return null;

						// Fanned out: the pins sit on a ring, and a leader line runs from
						// each back to the dot marking the coordinate they actually share.
						if (group.spread) {
							return (
								<Fragment key={group.key}>
									{group.spread.map(({ club, position }) => (
										<Polyline
											key={`leader-${club.id}`}
											positions={[group.center, position]}
											pathOptions={{ ...SPREAD_LEADER, className: "map-leader" }}
											interactive={false}
										/>
									))}
									<CircleMarker
										center={group.center}
										radius={3}
										pathOptions={{ ...SPREAD_ANCHOR, className: "map-anchor" }}
										interactive={false}
									/>
									{group.spread.map(({ club, position }) => {
										const memberKey = `${group.key}::${club.id}`;
										const memberHovered = hoveredKey === memberKey;
										const memberSelected =
											selection?.kind === "club" && selection.club.id === club.id;
										return (
											<Marker
												key={memberKey}
												position={position}
												componentIconOpts={CLUB_ICON_OPTS}
												icon={
													<ClubPin
														club={club}
														far={false}
														state={
															memberSelected
																? "selected"
																: memberHovered
																	? "hovered"
																	: "default"
														}
														labels={iconLabels}
														motion={enterMotion.get(memberKey)}
													/>
												}
												zIndexOffset={memberSelected ? 2000 : memberHovered ? 1000 : 0}
												eventHandlers={{
													mouseover: () => setHoveredKey(memberKey),
													mouseout: () => setHoveredKey(null),
													click: () => selectClub(club),
												}}
											/>
										);
									})}
								</Fragment>
							);
						}

						if (group.clubs.length > 1) {
							const openAsList = selection?.kind === "group" && selection.key === group.key;
							return (
								<Marker
									key={group.key}
									position={group.center}
									componentIconOpts={GROUP_ICON_OPTS}
									icon={
										<GroupPin
											count={group.clubs.length}
											far={far}
											hovered={hovered || openAsList}
											hint={groupHint(group, iconLabels)}
											motion={enterMotion.get(group.key)}
										/>
									}
									zIndexOffset={openAsList ? 2000 : hovered ? 1000 : 0}
									eventHandlers={{
										mouseover: () => setHoveredKey(group.key),
										mouseout: () => setHoveredKey(null),
										click: () => openGroup(group),
									}}
								/>
							);
						}

						const selected = selection?.kind === "club" && selection.club.id === first.id;
						return (
							<Marker
								key={group.key}
								position={group.center}
								componentIconOpts={CLUB_ICON_OPTS}
								icon={
									<ClubPin
										club={first}
										far={far}
										state={selected ? "selected" : hovered ? "hovered" : "default"}
										labels={iconLabels}
										motion={enterMotion.get(group.key)}
									/>
								}
								zIndexOffset={selected ? 2000 : hovered ? 1000 : 0}
								eventHandlers={{
									mouseover: () => setHoveredKey(group.key),
									mouseout: () => setHoveredKey(null),
									click: () => selectClub(first),
								}}
							/>
						);
					})}

				{/*
				 * The pins the last regroup removed, still on screen for as long as it
				 * takes them to leave. They're inert and sit under the live pins: their
				 * only job is to show where they went.
				 */}
				{!interactive &&
					ghosts.map((ghost) => {
						const first = ghost.clubs[0];
						if (!first) return null;

						return (
							<Marker
								key={`ghost-${ghost.id}`}
								position={ghost.at}
								interactive={false}
								zIndexOffset={-1000}
								componentIconOpts={ghost.group ? GROUP_ICON_OPTS : CLUB_ICON_OPTS}
								icon={
									ghost.group ? (
										<GroupPin
											count={ghost.clubs.length}
											far={far}
											hovered={false}
											hint=""
											motion={ghost.motion}
										/>
									) : (
										<ClubPin
											club={first}
											far={far}
											state="default"
											labels={iconLabels}
											motion={ghost.motion}
										/>
									)
								}
							/>
						);
					})}

				<ZoomControl position="bottomright" />
			</MapContainer>
		</div>
	);
}

export default ClubsMap;
