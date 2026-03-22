"use client";

import dynamic from "next/dynamic";

const ClubsMap = dynamic(() => import("@/components/clubs-map/clubs-map").then((mod) => mod.ClubsMap), {
	ssr: false,
});

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

interface ClubsMapWrapperProps {
	clubs: MapClub[];
	onLocationSelect?: (lat: number, lng: number) => void;
	interactive?: boolean;
	controlsBelowHeader?: boolean;
}

export function ClubsMapWrapper(props: ClubsMapWrapperProps) {
	return <ClubsMap {...props} />;
}
