"use client";

import {
	MapContainer,
	TileLayer,
	Marker,
	Popup,
	useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { useQueryState } from "nuqs";
import { useTranslations } from "next-intl";

// Fix Leaflet's default marker issue in Next.js
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
(L.Icon.Default.prototype as any)._getIconUrl = undefined;
L.Icon.Default.mergeOptions({
	iconRetinaUrl: "/images/leaflet/marker-icon-2x.png",
	iconUrl: "/images/leaflet/marker-icon.png",
	shadowUrl: "/images/leaflet/marker-shadow.png",
});

// Helper function to create a custom icon from club logo
function createClubIcon(logoUrl: string | null | undefined, size: number) {
	return L.divIcon({
		html: logoUrl
			? `<img src="${logoUrl}" style="width: ${size}px; height: ${size}px;" class="object-contain" />`
			: `<div class="rounded-full bg-primary border-2 border-white shadow-md" style="width: ${size / 2}px; height: ${size / 2}px;"></div>`,
		className: "club-marker",
		iconSize: [size, size],
		iconAnchor: [size / 2, size / 2],
	});
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
}: { position: [number, number]; logo?: string | null; }) {
	return position ? (
		<Marker position={position} icon={createClubIcon(logo, 32)} />
	) : null;
}

function MapEventHandler({
	onLocationSelect,
}: { onLocationSelect?: (lat: number, lng: number) => void; }) {
	useMapEvents({
		click: (e) => {
			if (onLocationSelect) {
				onLocationSelect(e.latlng.lat, e.latlng.lng);
			}
		},
	});
	return null;
}

export function ClubsMap({
	clubs,
	onLocationSelect,
	interactive = false,
}: ClubsMapProps) {
	const [mounted, setMounted] = useState(false);
	const [logoSize, setLogoSize] = useState(32); // Default size
	const [clubId] = useQueryState("clubId");
	const t = useTranslations("components.clubsMap");

	const prefilledClub = clubs.find(
		(club) => club.id === clubId || club.slug === clubId,
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
			{
				!interactive && (
					<div className="absolute right-4 top-4 z-[10] bg-white border dark:bg-[#0d0d0d] shadow-md p-3 flex items-center gap-3">
						<Slider
							value={[logoSize]}
							onValueChange={([value]) => setLogoSize(value ?? 32)}
							min={16}
							max={128}
							step={4}
							className="w-32"
						/>
					</div>
				)
			}

			<MapContainer
				center={[
					prefilledClub?.latitude || 43.8563,
					prefilledClub?.longitude || 18.4131,
				]}
				zoom={prefilledClub ? 14 : 8}
				className="h-full w-full z-0"
			>
				<TileLayer
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
					url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
				/>

				{interactive && <MapEventHandler onLocationSelect={onLocationSelect} />}

				{interactive && selectedLocation && (
					<LocationMarker position={selectedLocation} logo={clubs?.[0]?.logo} />
				)}

				{!interactive &&
					clubs?.map((club) =>
						club.latitude && club.longitude ? (
							<Marker
								key={club.id}
								position={[club.latitude, club.longitude]}
								icon={createClubIcon(club.logo, logoSize)}
							>
								<Popup className="rounded-none">
									<div className="flex flex-col items-center gap-2 p-2">
										<h3 className="font-semibold text-xl text-foreground">
											{club.name}
										</h3>
										<span className="text-foreground/80">{club.location}</span>
										<Link
											href={`/clubs/${club.slug || club.id}`}
											className="text-sm text-red-500 hover:underline plausible-event-name=club-map-profile-link"
										>
											{t('viewProfile')}
										</Link>
									</div>
								</Popup>
							</Marker>
						) : null,
					)}
			</MapContainer>
		</div>
	);
}
