"use client";

import { MapContainer, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Marker } from "@adamscybot/react-leaflet-component-marker";
import L from "leaflet";
import {
	ArrowUpRightIcon,
	Calendar,
	Eye,
	EyeOff,
	Globe,
	Handshake,
	InstagramIcon,
	MailOpenIcon,
	MapPin,
	Phone,
	Search,
	X,
} from "lucide-react";
import Image from "next/image";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { VerifiedClubIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Link } from "@/i18n/navigation";

// Minimal club type for map marker
interface MapClub {
	id: string;
	name: string;
	latitude: number | null;
	longitude: number | null;
	location: string | null;
	logo: string | null;
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

import { IMAGE_SIZES } from "@/lib/image-sizes";
import { Label } from "../ui/label";

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

// Clustering utilities
const MARKER_SIZE = 32; // Base marker size in pixels
const MIN_SPACING = 40; // Minimum spacing between markers in pixels

interface ClusterGroup {
	clubs: MapClub[];
	center: [number, number];
}

// Calculate pixel distance between two lat/lng points at given zoom
function calculatePixelDistance(map: L.Map, pos1: [number, number], pos2: [number, number]): number {
	const p1 = map.latLngToContainerPoint(pos1);
	const p2 = map.latLngToContainerPoint(pos2);
	return p1.distanceTo(p2);
}

// Check if two markers should be clustered at current zoom (more aggressive clustering)
function shouldClusterMarkers(
	map: L.Map,
	pos1: [number, number],
	pos2: [number, number],
	markerSize: number = MARKER_SIZE,
): boolean {
	const pixelDistance = calculatePixelDistance(map, pos1, pos2);
	const zoom = map.getZoom();

	// More aggressive clustering at lower zoom levels
	// At zoom 8: cluster if within 3x marker size
	// At zoom 12: cluster if within 2x marker size
	// At zoom 16+: cluster if within 1x marker size (normal overlap)
	const aggressionMultiplier = Math.max(1, (18 - zoom) / 4);
	const threshold = markerSize * aggressionMultiplier;

	return pixelDistance < threshold;
}

// Check if two clusters should be merged (more aggressive merging)
function shouldMergeClusters(cluster1: ClusterGroup, cluster2: ClusterGroup, map: L.Map, markerSize: number): boolean {
	const gridSize1 = Math.ceil(Math.sqrt(cluster1.clubs.length));
	const gridSize2 = Math.ceil(Math.sqrt(cluster2.clubs.length));
	const spacing1 = Math.max(MIN_SPACING, markerSize * 0.8);
	const spacing2 = Math.max(MIN_SPACING, markerSize * 0.8);

	// Calculate the effective radius of each cluster's grid
	const radius1 = ((gridSize1 - 1) / 2) * spacing1;
	const radius2 = ((gridSize2 - 1) / 2) * spacing2;

	const zoom = map.getZoom();
	// More aggressive merging at lower zoom levels
	const mergeMultiplier = Math.max(0.5, (18 - zoom) / 8);
	const totalRadius = (radius1 + radius2) * mergeMultiplier;

	return calculatePixelDistance(map, cluster1.center, cluster2.center) < totalRadius;
}

// Merge overlapping clusters hierarchically
function mergeOverlappingClusters(clusters: ClusterGroup[], map: L.Map, markerSize: number): ClusterGroup[] {
	let mergedClusters = [...clusters];

	while (mergedClusters.length > 1) {
		let merged = false;

		for (let i = 0; i < mergedClusters.length && !merged; i++) {
			const cluster1 = mergedClusters[i];
			if (!cluster1) continue;

			for (let j = i + 1; j < mergedClusters.length && !merged; j++) {
				const cluster2 = mergedClusters[j];
				if (!cluster2) continue;

				if (shouldMergeClusters(cluster1, cluster2, map, markerSize)) {
					// Merge clusters
					const mergedClubs = [...cluster1.clubs, ...cluster2.clubs];

					// Calculate new center
					let totalLat = 0;
					let totalLng = 0;
					let validClubs = 0;

					for (const club of mergedClubs) {
						if (club.latitude && club.longitude) {
							totalLat += club.latitude;
							totalLng += club.longitude;
							validClubs++;
						}
					}

					const newCenter: [number, number] = [totalLat / validClubs, totalLng / validClubs];

					const newCluster: ClusterGroup = {
						clubs: mergedClubs,
						center: newCenter,
					};

					// Replace the two clusters with the merged one
					const newClusters = mergedClusters.filter((_, index) => index !== i && index !== j);
					newClusters.push(newCluster);

					mergedClusters = newClusters;
					merged = true;
				}
			}
		}

		if (!merged) break; // No more merges possible
	}

	return mergedClusters;
}

// Group clubs that would overlap into clusters (aggressive clustering)
function createClusters(clubs: MapClub[], map: L.Map, markerSize: number): ClusterGroup[] {
	const clusters: ClusterGroup[] = [];
	const processed = new Set<string>();
	const zoom = map.getZoom();

	// First pass: create initial clusters of directly overlapping clubs
	for (const club of clubs) {
		if (!club.latitude || !club.longitude || processed.has(club.id)) continue;

		const currentPos: [number, number] = [club.latitude, club.longitude];
		const cluster: MapClub[] = [club];
		processed.add(club.id);

		// Find all clubs that would overlap with this one
		for (const otherClub of clubs) {
			if (!otherClub.latitude || !otherClub.longitude || processed.has(otherClub.id) || otherClub.id === club.id)
				continue;

			const otherPos: [number, number] = [otherClub.latitude, otherClub.longitude];

			if (shouldClusterMarkers(map, currentPos, otherPos, markerSize)) {
				cluster.push(otherClub);
				processed.add(otherClub.id);
			}
		}

		// At very low zoom levels, force clustering even for single clubs
		// This ensures we get larger clusters when zoomed way out
		const shouldForceCluster = cluster.length === 1 && zoom < 10;

		if (cluster.length > 1 || shouldForceCluster) {
			// Calculate center of cluster (all clubs in cluster should have valid coordinates)
			let totalLat = 0;
			let totalLng = 0;
			let validClubs = 0;

			for (const c of cluster) {
				if (c.latitude && c.longitude) {
					totalLat += c.latitude;
					totalLng += c.longitude;
					validClubs++;
				}
			}

			if (validClubs > 0) {
				const avgLat = totalLat / validClubs;
				const avgLng = totalLng / validClubs;
				clusters.push({ clubs: cluster, center: [avgLat, avgLng] });
			}
		}
	}

	// Second pass: merge clusters that would still overlap after grid arrangement
	return mergeOverlappingClusters(clusters, map, markerSize);
}

// Arrange clubs in a cluster in a grid pattern
function arrangeClusterInGrid(cluster: ClusterGroup, map: L.Map, markerSize: number): Map<string, [number, number]> {
	const { clubs, center } = cluster;
	const positions = new Map<string, [number, number]>();

	if (clubs.length === 1) {
		const club = clubs[0];
		if (club?.latitude && club?.longitude) {
			positions.set(club.id, [club.latitude, club.longitude]);
		}
		return positions;
	}

	// Calculate grid dimensions
	const gridSize = Math.ceil(Math.sqrt(clubs.length));
	const spacing = Math.max(MIN_SPACING, markerSize * 0.8);

	// Convert center to pixel coordinates
	const centerPixel = map.latLngToContainerPoint(center);

	clubs.forEach((club, index) => {
		if (!club || !club.latitude || !club.longitude) return;

		const row = Math.floor(index / gridSize);
		const col = index % gridSize;

		// Calculate offset from center
		const offsetX = (col - (gridSize - 1) / 2) * spacing;
		const offsetY = (row - (gridSize - 1) / 2) * spacing;

		// Convert back to lat/lng
		const markerPixel = centerPixel.add([offsetX, offsetY]);
		const markerLatLng = map.containerPointToLatLng(markerPixel);

		positions.set(club.id, [markerLatLng.lat, markerLatLng.lng]);
	});

	return positions;
}

// Get clustered positions for all clubs
function getClusteredPositions(clubs: MapClub[], map: L.Map, markerSize: number): Map<string, [number, number]> {
	const positions = new Map<string, [number, number]>();
	const clusters = createClusters(clubs, map, markerSize);

	// Add non-clustered clubs first
	const clusteredClubIds = new Set<string>();
	for (const cluster of clusters) {
		for (const club of cluster.clubs) {
			clusteredClubIds.add(club.id);
		}
	}

	// Position non-clustered clubs at exact locations
	for (const club of clubs) {
		if (!clusteredClubIds.has(club.id) && club.latitude && club.longitude) {
			positions.set(club.id, [club.latitude, club.longitude]);
		}
	}

	// Position clustered clubs in grid
	for (const cluster of clusters) {
		const clusterPositions = arrangeClusterInGrid(cluster, map, markerSize);
		for (const [clubId, pos] of clusterPositions) {
			positions.set(clubId, pos);
		}
	}

	return positions;
}

// Animated marker component with smooth transitions
function AnimatedMarker({
	position,
	icon,
	eventHandlers,
	zIndexOffset,
}: {
	position: [number, number];
	icon: React.ReactElement;
	eventHandlers?: L.LeafletEventHandlerFnMap;
	zIndexOffset?: number;
}) {
	const markerRef = useRef<L.Marker | null>(null);
	const animationRef = useRef<number | null>(null);
	const [currentPosition, setCurrentPosition] = useState(position);

	// Smooth animation between positions
	useEffect(() => {
		const [newLat, newLng] = position;
		const [currentLat, currentLng] = currentPosition;

		// If positions are the same, no animation needed
		if (Math.abs(newLat - currentLat) < 0.000001 && Math.abs(newLng - currentLng) < 0.000001) {
			return;
		}

		// Cancel any existing animation
		if (animationRef.current) {
			cancelAnimationFrame(animationRef.current);
		}

		const startTime = Date.now();
		const duration = 300; // 300ms animation

		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// Easing function (ease-out cubic)
			const easeProgress = 1 - (1 - progress) ** 3;

			const lat = currentLat + (newLat - currentLat) * easeProgress;
			const lng = currentLng + (newLng - currentLng) * easeProgress;

			if (markerRef.current) {
				markerRef.current.setLatLng([lat, lng]);
			}

			if (progress < 1) {
				animationRef.current = requestAnimationFrame(animate);
			} else {
				setCurrentPosition(position);
				animationRef.current = null;
			}
		};

		setCurrentPosition([newLat, newLng]);
		animationRef.current = requestAnimationFrame(animate);

		return () => {
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current);
			}
		};
	}, [position, currentPosition]);

	return (
		<Marker
			ref={markerRef}
			position={currentPosition}
			icon={icon}
			eventHandlers={eventHandlers}
			zIndexOffset={zIndexOffset}
		/>
	);
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

// Helper function to create a custom icon from club logo
function createClubIcon(
	logoUrl: string | null | undefined,
	size: number,
	clubName: string,
	isHovered: boolean,
	t: ReturnType<typeof useExtracted>,
) {
	const iconContent = logoUrl ? (
		<Image
			src={logoUrl}
			alt={t("Club logo")}
			className="object-contain"
			width={IMAGE_SIZES.ICON}
			height={IMAGE_SIZES.ICON}
			style={{
				width: `${size}px`,
				height: `${size}px`,
			}}
		/>
	) : (
		<MapPin size={size} strokeWidth={2} className="text-red-500" />
	);

	return (
		<div className="relative flex flex-col items-center">
			<div className="transition-transform hover:scale-125">{iconContent}</div>
			{isHovered && (
				<div className="absolute top-full mt-1 bg-black/80 text-white px-2 py-1 rounded text-xs whitespace-nowrap z-50">
					{clubName}
				</div>
			)}
		</div>
	);
}

// Club type imported from API

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
}

function LocationMarker({
	position,
	logo,
	t,
}: {
	position: [number, number];
	logo?: string | null;
	t: ReturnType<typeof useExtracted>;
}) {
	return position ? <Marker position={position} icon={createClubIcon(logo, 32, "", false, t)} /> : null;
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

export function ClubsMap({ clubs, onLocationSelect, interactive = false, focusPoint }: ClubsMapProps) {
	const [mounted, setMounted] = useState(false);
	const [logoSize, setLogoSize] = useState(32); // Default size
	const [clubId] = useQueryState("clubId");
	const [hoveredClubId, setHoveredClubId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [targetClub, setTargetClub] = useState<MapClub | null>(null);
	const [clusteredPositions, setClusteredPositions] = useState<Map<string, [number, number]>>(new Map());
	const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
	const [clusteringEnabled, setClusteringEnabled] = useState(false); // Default to disabled
	const [selectedClubForOverview, setSelectedClubForOverview] = useState<MapClub | null>(null);
	const t = useExtracted();

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

	// Update marker positions when map, clubs, clustering settings, or marker size changes
	useEffect(() => {
		if (!mapInstance || !clubs.length) return;

		const updatePositions = () => {
			let positions: Map<string, [number, number]>;

			if (clusteringEnabled) {
				positions = getClusteredPositions(clubs, mapInstance, logoSize);
			} else {
				// Use exact positions when clustering is disabled
				positions = new Map();
				for (const club of clubs) {
					if (club.latitude && club.longitude) {
						positions.set(club.id, [club.latitude, club.longitude]);
					}
				}
			}

			setClusteredPositions(positions);
		};

		updatePositions();

		// Listen for zoom changes to recalculate clustering
		const handleZoom = () => updatePositions();
		mapInstance.on("zoomend", handleZoom);

		return () => {
			mapInstance.off("zoomend", handleZoom);
		};
	}, [mapInstance, clubs, logoSize, clusteringEnabled]);

	if (!mounted) {
		return null;
	}

	const selectedLocation =
		clubs?.[0]?.latitude && clubs[0]?.longitude
			? ([clubs[0].latitude, clubs[0].longitude] as [number, number])
			: null;

	return (
		<div className="relative h-full w-full">
			{!interactive && (
				<>
					<div className="hidden md:flex absolute top-4 left-4 z-10">
						<div className="bg-white dark:bg-[#0d0d0d] border rounded-md p-3 w-80 flex flex-col gap-4">
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={clusteringEnabled}
									onChange={(e) => setClusteringEnabled(e.target.checked)}
									className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
								/>
								<span className="text-sm font-medium text-gray-900 dark:text-gray-300">
									{t("Clustering")}
								</span>
							</label>

							<div className="flex flex-col gap-2">
								<Label className="text-sm font-medium text-gray-900 dark:text-gray-300">
									{t("Logo size")}
								</Label>
								<Slider
									value={[logoSize]}
									onValueChange={([value]) => setLogoSize(value || 32)}
									min={16}
									max={64}
									step={16}
									className="w-full"
								/>
							</div>

							<div className="flex flex-col gap-3 border-t pt-3">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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
													{club.logo ? (
														<Image
															src={club.logo}
															alt=""
															width={24}
															height={24}
															className="w-6 h-6 object-contain rounded flex-shrink-0"
														/>
													) : (
														<MapPin className="w-6 h-6 text-red-500 flex-shrink-0" />
													)}
													<div className="flex-1 min-w-0">
														<div className="font-medium truncate">{club.name}</div>
														{club.location && (
															<div className="text-sm text-gray-500 dark:text-gray-400 truncate">
																{club.location}
															</div>
														)}
													</div>
												</button>
											))
										) : (
											<div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
												{t("No clubs found")}
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					</div>

					{selectedClubForOverview && (
						<div className="hidden md:flex absolute top-4 right-4 z-10">
							<div className="relative bg-white dark:bg-[#0d0d0d] border rounded-md p-4 w-80 flex flex-col gap-3">
								<Button
									variant="ghost"
									size="sm"
									className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
									onClick={() => setSelectedClubForOverview(null)}
								>
									<X className="h-4 w-4" />
								</Button>

								<div className="flex items-start gap-3">
									{selectedClubForOverview.logo ? (
										<Image
											src={selectedClubForOverview.logo}
											alt=""
											width={48}
											height={48}
											className="w-12 h-12 object-contain rounded flex-shrink-0"
										/>
									) : (
										<MapPin className="w-12 h-12 text-red-500 flex-shrink-0" />
									)}
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<h3 className="font-semibold text-lg truncate">
												{selectedClubForOverview.name}
											</h3>
											{selectedClubForOverview.verified && <VerifiedClubIcon />}
										</div>
										{selectedClubForOverview.location && (
											<p className="text-sm text-gray-600 dark:text-gray-400 truncate">
												{selectedClubForOverview.location}
											</p>
										)}
									</div>
								</div>

								{selectedClubForOverview.description && (
									<p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
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

					<div className="md:hidden absolute bottom-4 left-4 right-4 z-10 space-y-2">
						{searchQuery && filteredClubs.length > 0 && (
							<div className="bg-white dark:bg-[#0d0d0d] border rounded-md max-h-48 overflow-y-auto">
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
										{club.logo ? (
											<Image
												src={club.logo}
												alt=""
												width={24}
												height={24}
												className="w-6 h-6 object-contain rounded flex-shrink-0"
											/>
										) : (
											<MapPin className="w-6 h-6 text-red-500 flex-shrink-0" />
										)}
										<div className="flex-1 min-w-0">
											<div className="font-medium truncate">{club.name}</div>
											{club.location && (
												<div className="text-sm text-gray-500 dark:text-gray-400 truncate">
													{club.location}
												</div>
											)}
										</div>
									</button>
								))}
							</div>
						)}

						<div className="bg-white dark:bg-[#0d0d0d] border rounded-md p-3">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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

				{interactive && <MapEventHandler onLocationSelect={onLocationSelect} />}

				{interactive && selectedLocation && (
					<LocationMarker position={selectedLocation} logo={clubs?.[0]?.logo} t={t} />
				)}

				{!interactive &&
					clubs?.map((club) => {
						const position =
							clusteredPositions.get(club.id) ||
							(club.latitude && club.longitude ? [club.latitude, club.longitude] : null);
						return position ? (
							<AnimatedMarker
								key={club.id}
								position={position as [number, number]}
								icon={createClubIcon(club.logo, logoSize, club.name, hoveredClubId === club.id, t)}
								zIndexOffset={hoveredClubId === club.id ? 1000 : 0}
								eventHandlers={{
									mouseover: () => setHoveredClubId(club.id),
									mouseout: () => setHoveredClubId(null),
									click: () => setSelectedClubForOverview(club),
								}}
							/>
						) : null;
					})}

				<ZoomControl position="bottomright" />
			</MapContainer>
		</div>
	);
}
