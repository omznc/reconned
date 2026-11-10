"use client";

import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { useExtracted } from "next-intl";
import { parseAsBoolean, parseAsInteger, useQueryState } from "nuqs";
import {
	type ComponentProps,
	type Dispatch,
	type RefObject,
	type SetStateAction,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { CLUB_MARKER, type ClubIconLabels, ClubPin } from "@/components/clubs-map/club-pins";
import { distanceKm, type LatLng, toGroupingZoom, toMapZoom } from "@/components/clubs-map/geo";
import { type ClubGroup, MAX_ZOOM, SPREAD_MAX, SPREAD_ZOOM } from "@/components/clubs-map/grouping";
import { MapMarker } from "@/components/clubs-map/map-marker";
import { ClubMarkers } from "@/components/clubs-map/map-markers";
import {
	type ClubWithDistance,
	filterClubs,
	type MapCountry,
	type MapFilterState,
	MapPeek,
	MapPill,
	MapSidebar,
} from "@/components/clubs-map/map-panels";
import { type MapSelection, SelectionBody, selectionCenter } from "@/components/clubs-map/map-selection";
import { useMapLibre } from "@/components/clubs-map/use-maplibre-map";
import { useRegrouping } from "@/components/clubs-map/use-regrouping";
import { cn } from "@/lib/utils";

// Minimal club type for map marker
export interface MapClub {
	id: string;
	name: string;
	latitude: number | null;
	longitude: number | null;
	location: string | null;
	city?: string | null;
	countryId?: number | null;
	memberCount?: number | null;
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
	/** Country names for the filter. Only countries that have clubs are needed. */
	countries?: MapCountry[];
}

/** Zoom values here and below are in grouping zoom, see geo.ts. */
const CLUB_FLIGHT_ZOOM = 16;
const FOCUS_FLIGHT_ZOOM = 12;

function hasCoordinates(club: MapClub): club is MapClub & { latitude: number; longitude: number } {
	return typeof club.latitude === "number" && typeof club.longitude === "number";
}

/**
 * Flies to the club that search picked, or to the focus point the editor passes.
 * Keyed on the coordinates so an unchanged focus point does not fly again.
 */
function useMapFlight(map: MapLibreMap | null, targetClub: MapClub | null, focusPoint?: MapFocusPoint | null) {
	const focusLat = focusPoint?.lat;
	const focusLng = focusPoint?.lng;
	const focusZoom = focusPoint?.zoom;

	useEffect(() => {
		if (!map) return;

		if (targetClub?.latitude && targetClub?.longitude) {
			map.flyTo({
				center: [targetClub.longitude, targetClub.latitude],
				zoom: toMapZoom(CLUB_FLIGHT_ZOOM),
				duration: 1500,
			});
			return;
		}

		if (typeof focusLat === "number" && typeof focusLng === "number") {
			map.flyTo({
				center: [focusLng, focusLat],
				zoom: toMapZoom(focusZoom || FOCUS_FLIGHT_ZOOM),
				duration: 1500,
			});
		}
	}, [map, targetClub, focusLat, focusLng, focusZoom]);
}

/** Pans by the least distance that brings the point inside the padded container. */
function panIntoView(map: MapLibreMap, [lat, lng]: LatLng, top: number, bottom: number) {
	const point = map.project([lng, lat]);
	const { clientWidth, clientHeight } = map.getContainer();
	const margin = 24;
	const dx = Math.min(0, point.x - margin) || Math.max(0, point.x - (clientWidth - margin));
	const dy = Math.min(0, point.y - top) || Math.max(0, point.y - (clientHeight - bottom));
	if (dx !== 0 || dy !== 0) map.panBy([dx, dy], { duration: 400 });
}

/**
 * On a phone the card is a sheet over the bottom of the map, which is exactly
 * where a tapped pin tends to sit. Nudge the map so whatever the card is about
 * stays visible above it. Keyed on the coordinate rather than the selection
 * object, so re-rendering the same card doesn't fight the viewer's panning.
 */
function useSheetClearance(
	map: MapLibreMap | null,
	selection: MapSelection | null,
	sheetRef: RefObject<HTMLDivElement | null>,
) {
	const at = selection ? selectionCenter(selection) : null;
	const lat = at?.[0];
	const lng = at?.[1];

	useEffect(() => {
		if (!map || lat === undefined || lng === undefined) return;
		if (window.matchMedia("(min-width: 768px)").matches) return;

		// One frame, so the sheet has been laid out and can be measured.
		const frame = requestAnimationFrame(() => {
			const sheetHeight = sheetRef.current?.offsetHeight ?? 0;
			// Clear of the header and the search pill sitting under it.
			panIntoView(map, [lat, lng], 96, sheetHeight + 24);
		});

		return () => cancelAnimationFrame(frame);
	}, [map, lat, lng, sheetRef]);
}

/** Filter state. The toggles and the country live in the URL so a filtered map can be shared. */
function useMapFilters() {
	const [verified, setVerified] = useQueryState("verified", parseAsBoolean.withDefault(false));
	const [allied, setAllied] = useQueryState("allied", parseAsBoolean.withDefault(false));
	const [country, setCountry] = useQueryState("country", parseAsInteger);
	const [query, setQuery] = useState("");

	const onChange = useCallback(
		(patch: Partial<MapFilterState>) => {
			if (patch.query !== undefined) setQuery(patch.query);
			if (patch.verified !== undefined) void setVerified(patch.verified || null);
			if (patch.allied !== undefined) void setAllied(patch.allied || null);
			if (patch.country !== undefined) void setCountry(patch.country);
		},
		[setVerified, setAllied, setCountry],
	);

	const filters = useMemo<MapFilterState>(
		() => ({ query, verified, allied, country }),
		[query, verified, allied, country],
	);
	return { filters, onChange };
}

interface MapView {
	bounds: ReturnType<MapLibreMap["getBounds"]>;
	center: LatLng;
}

/**
 * The clubs the side list shows: those inside the viewport, nearest to its centre
 * first. A search ignores the viewport, because the match may be off screen.
 */
function useListEntries(shown: MapClub[], map: MapLibreMap | null, searching: boolean): ClubWithDistance<MapClub>[] {
	const [view, setView] = useState<MapView | null>(null);

	useEffect(() => {
		if (!map) return;

		const update = () => {
			const { lat, lng } = map.getCenter();
			setView({ bounds: map.getBounds(), center: [lat, lng] });
		};
		update();
		map.on("moveend", update);

		return () => {
			map.off("moveend", update);
		};
	}, [map]);

	return useMemo(() => {
		const entries: ClubWithDistance<MapClub>[] = [];
		for (const club of shown) {
			if (!hasCoordinates(club)) continue;
			if (!searching && view && !view.bounds.contains([club.longitude, club.latitude])) continue;
			const km = view ? distanceKm(view.center, [club.latitude, club.longitude]) : null;
			entries.push({ club, km });
		}
		return entries.sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
	}, [shown, view, searching]);
}

/**
 * The site header wraps to two rows on narrow screens, so how far down the
 * controls have to start is something only the header itself knows.
 */
function useHeaderHeight(enabled: boolean): number {
	const [headerHeight, setHeaderHeight] = useState(56);

	useEffect(() => {
		if (!enabled) return;

		const header = document.querySelector("header");
		if (!header) return;

		const measure = () => setHeaderHeight(header.getBoundingClientRect().height);
		measure();

		const observer = new ResizeObserver(measure);
		observer.observe(header);

		return () => observer.disconnect();
	}, [enabled]);

	return enabled ? headerHeight : 0;
}

type GroupOpening = { kind: "list" } | { kind: "fly"; center: LatLng; zoom: number };

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
function planGroupOpening(group: ClubGroup, currentZoom: number): GroupOpening | null {
	const located = group.clubs.filter(hasCoordinates);
	if (located.length === 0) return null;

	if (group.openZoom === null) {
		if (group.clubs.length > SPREAD_MAX) return { kind: "list" };
		return { kind: "fly", center: group.center, zoom: Math.max(SPREAD_ZOOM, currentZoom) };
	}

	// Centred on the group's bounds rather than its pin, so the members that
	// do fit at the separating zoom are the ones on screen.
	const lats = located.map((club) => club.latitude);
	const lngs = located.map((club) => club.longitude);
	const center: LatLng = [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
	return { kind: "fly", center, zoom: Math.min(MAX_ZOOM, group.openZoom) };
}

/** A pin click reaches the map too, in case the marker's own handler did not stop it. */
function isMarkerClick(event: MapMouseEvent): boolean {
	return event.originalEvent.target instanceof Element && event.originalEvent.target.closest(".map-marker") !== null;
}

/**
 * A click on the basemap picks a location when the editor listens for one, and
 * otherwise clears the selection.
 */
function useBasemapClick(
	map: MapLibreMap | null,
	onLocationSelect: ((lat: number, lng: number) => void) | undefined,
	onDeselect: () => void,
) {
	useEffect(() => {
		if (!map) return;

		const onClick = (event: MapMouseEvent) => {
			if (isMarkerClick(event)) return;
			if (onLocationSelect) {
				onLocationSelect(event.lngLat.lat, event.lngLat.lng);
				return;
			}
			onDeselect();
		};
		map.on("click", onClick);

		return () => {
			map.off("click", onClick);
		};
	}, [map, onLocationSelect, onDeselect]);
}

function useGroupOpening(
	map: MapLibreMap | null,
	groups: ClubGroup[],
	setSelection: Dispatch<SetStateAction<MapSelection | null>>,
) {
	// Zooming can redraw a group's membership. A list left open for a group
	// that no longer exists describes nothing on screen, so it closes.
	useEffect(() => {
		setSelection((current) =>
			current?.kind === "group" && !groups.some((group) => group.key === current.key) ? null : current,
		);
	}, [groups, setSelection]);

	return useCallback(
		(group: ClubGroup) => {
			if (!map) return;

			const opening = planGroupOpening(group, toGroupingZoom(map.getZoom()));
			if (opening?.kind === "list") {
				setSelection({ kind: "group", key: group.key, clubs: group.clubs });
			} else if (opening) {
				map.flyTo({
					center: [opening.center[1], opening.center[0]],
					zoom: toMapZoom(opening.zoom),
					duration: 1000,
				});
			}
		},
		[map, setSelection],
	);
}

interface MapOverlaysProps {
	filters: MapFilterState;
	countries: MapCountry[];
	onChange: (patch: Partial<MapFilterState>) => void;
	entries: ClubWithDistance<MapClub>[];
	searching: boolean;
	selection: MapSelection | null;
	sheetRef: RefObject<HTMLDivElement | null>;
	onSelectClub: (club: MapClub) => void;
	onSelectFromSearch: (club: MapClub) => void;
	onEnter: () => void;
	onClose: () => void;
}

/** The panels over the map: the card on desktop, and on a phone the search pill plus the sheet or the list peek. */
function MapOverlays(props: MapOverlaysProps) {
	const { filters, countries, onChange, entries, searching, selection, sheetRef } = props;
	const [listOpen, setListOpen] = useState(false);
	const [filtersOpen, setFiltersOpen] = useState(false);

	// A selection replaces the peek, so the list must not come back open after it.
	useEffect(() => {
		if (selection) setListOpen(false);
	}, [selection]);

	const body = selection && (
		<SelectionBody selection={selection} onSelect={props.onSelectClub} onClose={props.onClose} />
	);

	return (
		<>
			{body && (
				<div className="absolute top-4 right-4 z-[1200] hidden w-80 overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lg md:block">
					{body}
				</div>
			)}

			{/* Phone: a search pill on top, and at the bottom either the selected club or the list peek. */}
			<div className="absolute inset-x-3 top-3 z-[1200] md:hidden">
				<MapPill
					filters={filters}
					countries={countries}
					onChange={onChange}
					onEnter={props.onEnter}
					filtersOpen={filtersOpen}
					onToggleFilters={() => setFiltersOpen((open) => !open)}
				/>
			</div>

			{body ? (
				<div
					ref={sheetRef}
					className="map-sheet absolute inset-x-0 bottom-0 z-[1200] max-h-[75dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t bg-card pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_24px_rgba(27,26,24,0.18)] md:hidden"
				>
					{body}
				</div>
			) : (
				<MapPeek
					entries={entries}
					searching={searching}
					expanded={listOpen}
					onToggleList={() => setListOpen((open) => !open)}
					onSelect={props.onSelectFromSearch}
				/>
			)}
		</>
	);
}

/** The editor passes one club and wants it drawn, so filters only apply to the public map. */
function useShownClubs(clubs: MapClub[], filters: MapFilterState, interactive: boolean): MapClub[] {
	return useMemo(() => (interactive ? clubs : filterClubs(clubs, filters)), [interactive, clubs, filters]);
}

function selectedClubId(selection: MapSelection | null): string | null {
	return selection?.kind === "club" ? selection.club.id : null;
}

/** Escape is the other way out of a selection, so the overview never feels like something you're stuck inside. */
function useEscape(active: boolean, onEscape: () => void) {
	useEffect(() => {
		if (!active) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onEscape();
		};
		window.addEventListener("keydown", onKeyDown);

		return () => window.removeEventListener("keydown", onKeyDown);
	}, [active, onEscape]);
}

/** Where the map opens: the focus point, else the club named in the URL, else Sarajevo. */
function useInitialView(clubs: MapClub[], focusPoint?: MapFocusPoint | null): { center: LatLng; zoom: number } {
	const [clubId] = useQueryState("clubId");

	// The null guard matters: without it a missing `clubId` matches the first club
	// that happens to have no slug, and the map silently opens on that club.
	const prefilledClub = clubId ? clubs.find((club) => club.id === clubId || club.slug === clubId) : undefined;

	if (focusPoint) return { center: [focusPoint.lat, focusPoint.lng], zoom: focusPoint.zoom || 8 };
	return {
		center: [prefilledClub?.latitude || 43.8563, prefilledClub?.longitude || 18.4131],
		zoom: prefilledClub ? 14 : 8,
	};
}

/** The editor passes one club and wants it drawn where the click landed. */
function EditorMarker({ map, club, labels }: { map: MapLibreMap; club?: MapClub; labels: ClubIconLabels }) {
	if (!club?.latitude || !club.longitude) return null;

	return (
		<MapMarker map={map} position={[club.latitude, club.longitude]} {...CLUB_MARKER}>
			<ClubPin
				club={{ name: club.name, logo: club.logo, logoTile: club.logoTile ?? null }}
				state="default"
				far={false}
				labels={labels}
			/>
		</MapMarker>
	);
}

type PinsLayerProps = Omit<ComponentProps<typeof ClubMarkers>, "map"> & {
	map: MapLibreMap | null;
	interactive: boolean;
	editorClub?: MapClub;
};

/** The editor draws its one club, the public map draws every group. */
function PinsLayer({ map, interactive, editorClub, ...markers }: PinsLayerProps) {
	if (!map) return null;
	if (interactive) return <EditorMarker map={map} club={editorClub} labels={markers.labels} />;
	return <ClubMarkers map={map} {...markers} />;
}

export function ClubsMap({
	clubs,
	onLocationSelect,
	interactive = false,
	focusPoint,
	controlsBelowHeader = false,
	countries = [],
}: ClubsMapProps) {
	const initialView = useInitialView(clubs, focusPoint);
	const { filters, onChange } = useMapFilters();
	const [targetClub, setTargetClub] = useState<MapClub | null>(null);
	const [selection, setSelection] = useState<MapSelection | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const sheetRef = useRef<HTMLDivElement | null>(null);
	const t = useExtracted();
	const iconLabels: ClubIconLabels = {
		clubLocation: t("Club location"),
		group: t("Several clubs here — click to zoom in"),
		groupStacked: t("Several clubs at this exact spot — click to spread them out"),
		groupMany: t("Several clubs at this exact spot — click to list them"),
	};

	const { map, dark } = useMapLibre(containerRef, initialView);
	const headerHeight = useHeaderHeight(controlsBelowHeader && !interactive);

	const shown = useShownClubs(clubs, filters, interactive);
	const searching = filters.query.trim() !== "";
	const entries = useListEntries(shown, map, searching);
	const { groups, far, enterMotion, ghosts } = useRegrouping(map, shown);

	const deselect = useCallback(() => setSelection(null), []);
	const selectClub = useCallback((club: MapClub) => setSelection({ kind: "club", club }), []);

	useMapFlight(map, targetClub, focusPoint);
	useSheetClearance(map, selection, sheetRef);

	useBasemapClick(map, interactive ? onLocationSelect : undefined, deselect);
	const openGroup = useGroupOpening(map, groups, setSelection);

	/** Search jumps the map as well as opening the card. */
	const selectFromSearch = useCallback((club: MapClub) => {
		setTargetClub(club);
		setSelection({ kind: "club", club });
	}, []);

	const selectFirstMatch = useCallback(() => {
		const first = entries[0]?.club;
		if (first) selectFromSearch(first);
	}, [entries, selectFromSearch]);

	useEscape(selection !== null, deselect);

	return (
		// The site header wraps to two rows on narrow screens, so its height is measured
		// and the map starts below it.
		<div className="relative h-full w-full" style={{ paddingTop: headerHeight }}>
			<div className={cn("flex h-full w-full", !interactive && "md:gap-4 md:p-4")}>
				{!interactive && (
					<MapSidebar
						filters={filters}
						countries={countries}
						onChange={onChange}
						entries={entries}
						searching={searching}
						selectedId={selectedClubId(selection)}
						onSelect={selectFromSearch}
						onEnter={selectFirstMatch}
					/>
				)}
				<div
					className={cn(
						"relative h-full min-w-0 flex-1 overflow-hidden",
						!interactive && "md:rounded-lg md:border",
					)}
				>
					{!interactive && (
						<MapOverlays
							filters={filters}
							countries={countries}
							onChange={onChange}
							entries={entries}
							searching={searching}
							selection={selection}
							sheetRef={sheetRef}
							onSelectClub={selectClub}
							onSelectFromSearch={selectFromSearch}
							onEnter={selectFirstMatch}
							onClose={deselect}
						/>
					)}

					<div ref={containerRef} className="z-0 h-full w-full" />

					<PinsLayer
						map={map}
						interactive={interactive}
						editorClub={clubs[0]}
						groups={groups}
						ghosts={ghosts}
						enterMotion={enterMotion}
						far={far}
						dark={dark}
						selection={selection}
						labels={iconLabels}
						onSelectClub={selectClub}
						onOpenGroup={openGroup}
					/>
				</div>
			</div>
		</div>
	);
}

export default ClubsMap;
