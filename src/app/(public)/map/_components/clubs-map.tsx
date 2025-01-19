"use client";

import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from 'leaflet';
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useEffect, useState } from "react";

// Fix Leaflet's default marker issue in Next.js
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
(L.Icon.Default.prototype as any)._getIconUrl = undefined;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/images/leaflet/marker-icon-2x.png',
    iconUrl: '/images/leaflet/marker-icon.png',
    shadowUrl: '/images/leaflet/marker-shadow.png',
});

// Helper function to create a custom icon from club logo
function createClubIcon(logoUrl: string | null | undefined) {
    return L.divIcon({
        html: logoUrl
            ? `<img src="${logoUrl}" class="size-10 shadow-md" />`
            : `<div class="size-4 rounded-full bg-primary border-2 border-white shadow-md"></div>`,
        className: 'club-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
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

function LocationMarker({ position, logo }: { position: [number, number]; logo?: string | null; }) {
    return position ? (
        <Marker
            position={position}
            icon={createClubIcon(logo)}
        />
    ) : null;
}

function MapEventHandler({ onLocationSelect }: { onLocationSelect?: (lat: number, lng: number) => void; }) {
    useMapEvents({
        click: (e) => {
            if (onLocationSelect) {
                onLocationSelect(e.latlng.lat, e.latlng.lng);
            }
        },
    });
    return null;
}

export function ClubsMap({ clubs, onLocationSelect, interactive = false }: ClubsMapProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    const selectedLocation = clubs?.[0]?.latitude && clubs[0]?.longitude
        ? [clubs[0].latitude, clubs[0].longitude] as [number, number]
        : null;

    return (
        <MapContainer
            center={[43.8563, 18.4131]} // Sarajevo coordinates
            zoom={8}
            className="h-full w-full z-0"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {interactive && <MapEventHandler onLocationSelect={onLocationSelect} />}

            {interactive && selectedLocation && (
                <LocationMarker
                    position={selectedLocation}
                    logo={clubs?.[0]?.logo}
                />
            )}

            {!interactive && clubs?.map((club) => (
                club.latitude && club.longitude ? (
                    <Marker
                        key={club.id}
                        position={[club.latitude, club.longitude]}
                        icon={createClubIcon(club.logo)}
                    >
                        <Popup className="rounded-none">
                            <div className="flex flex-col items-center gap-2 p-2">
                                <h3 className="font-semibold text-xl text-foreground">{club.name}</h3>
                                <span className="text-foreground/80">{club.location}</span>
                                <Link
                                    href={`/clubs/${club.slug || club.id}`}
                                    className="text-sm text-red-500 hover:underline"
                                >
                                    Pogledaj profil
                                </Link>
                            </div>
                        </Popup>
                    </Marker>
                ) : null
            ))}
        </MapContainer>
    );
}
