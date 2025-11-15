"use client";

import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Marker } from "@adamscybot/react-leaflet-component-marker";
import { MapPin, Search } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { IMAGE_SIZES } from "@/lib/image-sizes";

// Helper function to create a custom icon from club logo
function createClubIcon(
	logoUrl: string | null | undefined,
	size: number,
	clubName: string,
	isHovered: boolean,
	t: ReturnType<typeof useTranslations>,
) {
	const iconContent = logoUrl ? (
		<Image
			src={logoUrl}
			alt={t("components.clubsMap.clubLogo")}
			className="object-contain"
			width={IMAGE_SIZES.THUMBNAIL}
			height={IMAGE_SIZES.THUMBNAIL}
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

interface Club {
	id: string;
	name: string;
	logo?: string | null;
	latitude: number | null;
	longitude: number | null;
	slug?: string | null;
	location?: string;
}

interface ClubsMapProps {
	clubs: Club[];
	onLocationSelect?: (lat: number, lng: number) => void;
	interactive?: boolean;
}

function LocationMarker({
	position,
	logo,
	t,
}: {
	position: [number, number];
	logo?: string | null;
	t: ReturnType<typeof useTranslations>;
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

function MapController({ targetClub }: { targetClub: Club | null }) {
	const map = useMap();

	useEffect(() => {
		if (targetClub?.latitude && targetClub?.longitude) {
			map.flyTo([targetClub.latitude, targetClub.longitude], 16, {
				duration: 1.5,
			});
		}
	}, [targetClub, map]);

	return null;
}

export function ClubsMap({ clubs, onLocationSelect, interactive = false }: ClubsMapProps) {
	const [mounted, setMounted] = useState(false);
	const [logoSize, setLogoSize] = useState(32); // Default size
	const [clubId] = useQueryState("clubId");
	const [hoveredClubId, setHoveredClubId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [targetClub, setTargetClub] = useState<Club | null>(null);
	const t = useTranslations();

	const prefilledClub = clubs.find((club) => club.id === clubId || club.slug === clubId);

	const filteredClubs = clubs.filter(
		(club) =>
			searchQuery === "" ||
			club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			club.location?.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	useEffect(() => {
		setMounted(true);
	}, []);

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
					{/* Desktop: Top right controls */}
					<div className="hidden md:flex absolute top-4 right-4 z-10 flex-col gap-3">
						{/* Logo Size Slider */}
						<div className="bg-white border dark:bg-[#0d0d0d] shadow-md p-3 w-80">
							<Slider
								value={[logoSize]}
								onValueChange={([value]) => setLogoSize(value ?? 32)}
								min={16}
								max={64}
								step={16}
								className="w-full"
							/>
						</div>

						{/* Search and Club List */}
						<div className="bg-white dark:bg-[#0d0d0d] border shadow-md p-3 w-80">
							<div className="flex flex-col gap-3">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
									<Input
										placeholder={t("components.clubsMap.searchClubs")}
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && filteredClubs.length > 0) {
												setTargetClub(filteredClubs[0] || null);
												setSearchQuery("");
											}
										}}
										className="pl-10 pr-4"
									/>
								</div>

								<div className="max-h-64 overflow-y-auto border-t pt-2">
									{filteredClubs.map((club) => (
										<button
											key={club.id}
											type="button"
											className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center gap-2 touch-manipulation"
											onClick={() => {
												setTargetClub(club);
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
							</div>
						</div>
					</div>

					{/* Mobile: Bottom search with results above */}
					<div className="md:hidden absolute bottom-4 left-4 right-4 z-10 space-y-2">
						{/* Search Results */}
						{searchQuery && filteredClubs.length > 0 && (
							<div className="bg-white dark:bg-[#0d0d0d] border shadow-md max-h-48 overflow-y-auto">
								{filteredClubs.slice(0, 5).map((club) => (
									<button
										key={club.id}
										type="button"
										className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center gap-2 touch-manipulation"
										onClick={() => {
											setTargetClub(club);
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

						{/* Search Input */}
						<div className="bg-white dark:bg-[#0d0d0d] border shadow-md p-3">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
								<Input
									placeholder={t("components.clubsMap.searchClubs")}
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && filteredClubs.length > 0) {
											setTargetClub(filteredClubs[0] || null);
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
				center={[prefilledClub?.latitude || 43.8563, prefilledClub?.longitude || 18.4131]}
				zoom={prefilledClub ? 14 : 8}
				scrollWheelZoom={false}
				className="h-full w-full z-0"
			>
				<TileLayer
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
					url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
				/>

				<MapController targetClub={targetClub} />

				{interactive && <MapEventHandler onLocationSelect={onLocationSelect} />}

				{interactive && selectedLocation && (
					<LocationMarker position={selectedLocation} logo={clubs?.[0]?.logo} t={t} />
				)}

				{!interactive &&
					clubs?.map((club) =>
						club.latitude && club.longitude ? (
							<Marker
								key={club.id}
								position={[club.latitude, club.longitude]}
								icon={createClubIcon(club.logo, logoSize, club.name, hoveredClubId === club.id, t)}
								zIndexOffset={hoveredClubId === club.id ? 1000 : 0}
								eventHandlers={{
									mouseover: () => setHoveredClubId(club.id),
									mouseout: () => setHoveredClubId(null),
									click: () => window.open(`/clubs/${club.slug || club.id}`, "_blank"),
								}}
							/>
						) : null,
					)}
			</MapContainer>
		</div>
	);
}
