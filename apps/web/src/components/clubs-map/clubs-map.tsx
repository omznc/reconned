"use client";

import { MapContainer, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Marker, type MarkerProps } from "@adamscybot/react-leaflet-component-marker";
import L from "leaflet";
import {
	ArrowUpRightIcon,
	Calendar,
	Eye,
	EyeOff,
	Globe,
	Handshake,
	MailOpenIcon,
	Phone,
	Search,
	X,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import { InstagramIcon, VerifiedClubIcon } from "@/components/icons";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Minimal club type for map marker
interface MapClub {
	id: string;
	name: string;
	latitude: number | null;
	longitude: number | null;
	location: string | null;
	logo: string | null;
	logoTile?: "paper" | "ink" | null;
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
// The old behaviour spread overlapping clubs out into a grid, which invented
// locations that don't exist. Grouping instead admits the overlap: one pin,
// one number, and a zoom that resolves it.
const PIN_SIZE = 44; // Default plate, in pixels
const PIN_FAR_SIZE = 28; // Zoomed out, no inner frame
const PIN_SELECTED_SIZE = 56;
const PIN_GAP = 8; // Breathing room between two pins before they merge
const FAR_ZOOM = 9; // At or below this, pins drop to their small form

/**
 * Every pin is drawn once at PIN_SIZE and then scaled, so a size change is a
 * transform the browser can animate rather than a relayout that snaps. The
 * collision threshold still needs the on-screen size, which is what this gives.
 */
function pinSizeForZoom(zoom: number): number {
	return zoom <= FAR_ZOOM ? PIN_FAR_SIZE : PIN_SIZE;
}

interface ClubGroup {
	/** Stable across renders for the same membership, so markers aren't recreated. */
	key: string;
	clubs: MapClub[];
	center: [number, number];
}

interface PlacedClub {
	club: MapClub;
	point: L.Point;
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
		groups.push({
			key: members
				.map((m) => m.club.id)
				.sort()
				.join("|"),
			clubs: members.map((m) => m.club),
			center: [center.lat, center.lng],
		});
	}

	return groups;
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
}

const PIN_SHADOW = "drop-shadow(0 3px 6px rgba(27,26,24,0.22)) drop-shadow(0 1px 1px rgba(27,26,24,0.14))";
const PIN_SHADOW_RAISED = "drop-shadow(0 8px 14px rgba(27,26,24,0.26)) drop-shadow(0 2px 3px rgba(27,26,24,0.16))";
const PLATE = "#ffffff";
const PLATE_SELECTED = "#b6221f";
const PLATE_STACK = "#faf8f4";
const PLATE_STACK_BORDER = "#e4e0d8";
const GROUP_PLATE = "#1b1a18";
const GROUP_INK = "#f4f2ee";

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
}: {
	club: Pick<MapClub, "name" | "logo" | "logoTile">;
	state: PinState;
	far: boolean;
	labels: ClubIconLabels;
}) {
	const selected = state === "selected";
	const raised = selected || state === "hovered";
	const plate = selected ? PLATE_SELECTED : PLATE;
	const pad = far && !selected ? 0 : PLATE_PAD;

	return (
		<div className="map-marker-in" style={{ position: "relative", width: "100%", height: "100%" }}>
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
	labels,
}: {
	count: number;
	far: boolean;
	hovered: boolean;
	labels: ClubIconLabels;
}) {
	const stack: CSSProperties = {
		...plateBody(PLATE_STACK),
		border: `1px solid ${PLATE_STACK_BORDER}`,
	};

	return (
		<div className="map-marker-in" style={{ position: "relative", width: "100%", height: "100%" }}>
			<div
				className="map-pin"
				style={{
					position: "absolute",
					inset: 0,
					transformOrigin: "50% 50%",
					transform: `scale(${pinScale(hovered ? "hovered" : "default", far)})`,
					filter: hovered ? PIN_SHADOW_RAISED : PIN_SHADOW,
				}}
				title={labels.group}
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
	const [selectedClubForOverview, setSelectedClubForOverview] = useState<MapClub | null>(null);
	const t = useExtracted();
	const iconLabels: ClubIconLabels = {
		clubLocation: t("Club location"),
		group: t("Several clubs here — click to zoom in"),
	};

	const prefilledClub = clubs.find((club) => club.id === clubId || club.slug === clubId);

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

	// Regroup on zoom. Panning is deliberately not a trigger: groups are computed
	// in projected space, so they're identical wherever the viewport sits.
	useEffect(() => {
		if (!mapInstance || !clubs.length) return;

		const regroup = () => {
			setGroups(groupClubs(clubs, mapInstance));
			setFar(mapInstance.getZoom() <= FAR_ZOOM);
		};

		regroup();
		mapInstance.on("zoomend", regroup);

		return () => {
			mapInstance.off("zoomend", regroup);
		};
	}, [mapInstance, clubs]);

	// A group opens by zooming to fit its members rather than by listing them —
	// the map itself answers "which ones", and the pins separate on the way in.
	const focusGroup = useCallback(
		(group: ClubGroup) => {
			if (!mapInstance) return;

			const points: [number, number][] = [];
			for (const club of group.clubs) {
				if (typeof club.latitude === "number" && typeof club.longitude === "number") {
					points.push([club.latitude, club.longitude]);
				}
			}
			if (points.length === 0) return;

			mapInstance.flyToBounds(L.latLngBounds(points), {
				padding: [80, 80],
				maxZoom: 17,
				duration: 1,
			});
		},
		[mapInstance],
	);

	const deselect = useCallback(() => setSelectedClubForOverview(null), []);

	// Escape is the other way out of a selection, so the overview never feels
	// like something you're stuck inside.
	useEffect(() => {
		if (!selectedClubForOverview) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") deselect();
		};
		window.addEventListener("keydown", onKeyDown);

		return () => window.removeEventListener("keydown", onKeyDown);
	}, [selectedClubForOverview, deselect]);

	if (!mounted) {
		return null;
	}

	const selectedLocation =
		clubs?.[0]?.latitude && clubs[0]?.longitude
			? ([clubs[0].latitude, clubs[0].longitude] as [number, number])
			: null;

	const controlsTopInset = controlsBelowHeader ? "top-[calc(1rem+3.5rem)] sm:top-[calc(1rem+4rem)]" : "top-4";

	return (
		<div
			className={cn(
				"relative h-full w-full",
				controlsBelowHeader &&
					"[&_.leaflet-top]:top-[calc(1rem+3.5rem)] sm:[&_.leaflet-top]:top-[calc(1rem+4rem)]",
			)}
		>
			{!interactive && (
				<>
					<div className={cn("hidden md:flex absolute left-4 z-10", controlsTopInset)}>
						<div className="bg-white dark:bg-[#0d0d0d] border rounded-md p-3 w-80 flex flex-col gap-4">
							<div className="flex flex-col gap-3">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder={t("Search clubs...")}
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && filteredClubs.length > 0) {
												setTargetClub(filteredClubs[0] || null);
												setSelectedClubForOverview(filteredClubs[0] || null);
												setSearchQuery("");
											}
										}}
										className="pl-10 pr-4"
									/>
								</div>

								{searchQuery && (
									<div className="max-h-64 overflow-y-auto border-t pt-2">
										{filteredClubs.length > 0 ? (
											filteredClubs.map((club) => (
												<button
													key={club.id}
													type="button"
													className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center gap-2 touch-manipulation"
													onClick={() => {
														setTargetClub(club);
														setSelectedClubForOverview(club);
														setSearchQuery("");
													}}
												>
													<ClubAvatar
														name={club.name}
														logo={club.logo}
														tile={club.logoTile}
														size={28}
														className="shrink-0"
													/>
													<div className="flex-1 min-w-0">
														<div className="font-medium truncate">{club.name}</div>
														{club.location && (
															<div className="text-sm text-muted-foreground truncate">
																{club.location}
															</div>
														)}
													</div>
												</button>
											))
										) : (
											<div className="px-3 py-2 text-sm text-muted-foreground text-center">
												{t("No clubs found")}
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					</div>

					{selectedClubForOverview && (
						<div className={cn("hidden md:flex absolute right-4 z-10", controlsTopInset)}>
							<div className="relative bg-white dark:bg-[#0d0d0d] border rounded-md p-4 w-80 flex flex-col gap-3">
								<Button
									variant="ghost"
									size="sm"
									className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
									onClick={deselect}
								>
									<X className="h-4 w-4" />
								</Button>

								<div className="flex items-start gap-3">
									<ClubAvatar
										name={selectedClubForOverview.name}
										logo={selectedClubForOverview.logo}
										tile={selectedClubForOverview.logoTile}
										size={48}
										className="shrink-0"
									/>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<h3 className="font-semibold text-lg truncate">
												{selectedClubForOverview.name}
											</h3>
											{selectedClubForOverview.verified && <VerifiedClubIcon />}
										</div>
										{selectedClubForOverview.location && (
											<p className="text-sm text-muted-foreground truncate">
												{selectedClubForOverview.location}
											</p>
										)}
									</div>
								</div>

								{selectedClubForOverview.description && (
									<p className="text-sm text-foreground line-clamp-3">
										{selectedClubForOverview.description}
									</p>
								)}

								<div className="flex flex-wrap gap-2">
									<Badge variant="secondary" className="flex items-center gap-1">
										{selectedClubForOverview.isPrivate ? (
											<>
												<EyeOff className="w-3 h-3" />
												{t("Private")}
											</>
										) : (
											<>
												<Eye className="w-3 h-3" />
												{t("Public")}
											</>
										)}
									</Badge>
									{selectedClubForOverview.isAllied && (
										<Badge variant="secondary" className="flex items-center gap-1">
											<Handshake className="w-3 h-3" />
											{t("ASK FBIH")}
										</Badge>
									)}
									{selectedClubForOverview.dateFounded && (
										<Badge variant="secondary">
											<Calendar />
											{t("Founded")} {new Date(selectedClubForOverview.dateFounded).getFullYear()}
										</Badge>
									)}
								</div>

								<div className="grid grid-cols-2 gap-2">
									{selectedClubForOverview.website && (
										<Button variant="outline" size="sm" asChild>
											<Link
												href={selectedClubForOverview.website}
												target="_blank"
												rel="noopener noreferrer"
											>
												<Globe />
												{t("Website")}
											</Link>
										</Button>
									)}
									{selectedClubForOverview.instagramUsername &&
										!selectedClubForOverview.website?.includes("instagram.com") && (
											<Button variant="outline" size="sm" asChild>
												<Link
													href={`https://instagram.com/${selectedClubForOverview.instagramUsername}`}
													target="_blank"
													rel="noopener noreferrer"
												>
													<InstagramIcon />
													{t("Instagram")}
												</Link>
											</Button>
										)}
									{selectedClubForOverview.contactEmail && (
										<Button variant="outline" size="sm" asChild>
											<Link href={`mailto:${selectedClubForOverview.contactEmail}`}>
												<MailOpenIcon />
												{t("Email")}
											</Link>
										</Button>
									)}
									{selectedClubForOverview.contactPhone && (
										<Button variant="outline" size="sm" asChild>
											<Link href={`tel:${selectedClubForOverview.contactPhone}`}>
												<Phone />
												{t("Call")}
											</Link>
										</Button>
									)}
								</div>

								<Button className="w-full" size="sm" asChild>
									<Link
										href={`/clubs/${selectedClubForOverview.slug || selectedClubForOverview.id}`}
										target="_blank"
									>
										{t("View Club")}
										<ArrowUpRightIcon />
									</Link>
								</Button>
							</div>
						</div>
					)}

					<div
						className={cn(
							"md:hidden absolute left-4 right-4 z-[1200] space-y-2 shadow-lg",
							controlsBelowHeader
								? "bottom-[max(1rem,calc(env(safe-area-inset-bottom,0px)+5.5rem))]"
								: "bottom-4",
						)}
					>
						{searchQuery && filteredClubs.length > 0 && (
							<div className="bg-white dark:bg-[#0d0d0d] border rounded-md max-h-48 overflow-y-auto shadow-md">
								{filteredClubs.slice(0, 5).map((club) => (
									<button
										key={club.id}
										type="button"
										className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center gap-2 touch-manipulation"
										onClick={() => {
											setTargetClub(club);
											setSelectedClubForOverview(club);
											setSearchQuery("");
										}}
									>
										<ClubAvatar
											name={club.name}
											logo={club.logo}
											tile={club.logoTile}
											size={28}
											className="shrink-0"
										/>
										<div className="flex-1 min-w-0">
											<div className="font-medium truncate">{club.name}</div>
											{club.location && (
												<div className="text-sm text-muted-foreground truncate">
													{club.location}
												</div>
											)}
										</div>
									</button>
								))}
							</div>
						)}

						<div className="rounded-md border bg-white p-3 shadow-md dark:bg-[#0d0d0d]">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
								<Input
									placeholder={t("Search clubs...")}
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && filteredClubs.length > 0) {
											setTargetClub(filteredClubs[0] || null);
											setSelectedClubForOverview(filteredClubs[0] || null);
											setSearchQuery("");
										}
									}}
									className="pl-10 pr-4"
								/>
							</div>
						</div>
					</div>
				</>
			)}

			<MapContainer
				center={defaultCenter}
				zoom={defaultZoom}
				className="h-full w-full z-0"
				zoomControl={false}
				zoomSnap={0.1}
				zoomDelta={0.25}
				wheelPxPerZoomLevel={120}
				wheelDebounceTime={40}
			>
				<OptimizedTileLayerComponent
					url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
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

						if (group.clubs.length > 1) {
							return (
								<Marker
									key={group.key}
									position={group.center}
									componentIconOpts={GROUP_ICON_OPTS}
									icon={
										<GroupPin
											count={group.clubs.length}
											far={far}
											hovered={hovered}
											labels={iconLabels}
										/>
									}
									zIndexOffset={hovered ? 1000 : 0}
									eventHandlers={{
										mouseover: () => setHoveredKey(group.key),
										mouseout: () => setHoveredKey(null),
										click: () => focusGroup(group),
									}}
								/>
							);
						}

						const selected = selectedClubForOverview?.id === first.id;
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
									/>
								}
								zIndexOffset={selected ? 2000 : hovered ? 1000 : 0}
								eventHandlers={{
									mouseover: () => setHoveredKey(group.key),
									mouseout: () => setHoveredKey(null),
									click: () => setSelectedClubForOverview(first),
								}}
							/>
						);
					})}

				<ZoomControl position="bottomright" />
			</MapContainer>
		</div>
	);
}

export default ClubsMap;
