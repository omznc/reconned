"use client";

import dynamic from "next/dynamic";
import type { MapClub } from "@/components/clubs-map/clubs-map";
import { LoadingPage } from "../loading-page";

const ClubsMap = dynamic(() => import("@/components/clubs-map/clubs-map").then((mod) => mod.ClubsMap), {
	ssr: false,
	loading: () => <LoadingPage />,
});

interface ClubsMapWrapperProps {
	clubs: MapClub[];
	onLocationSelect?: (lat: number, lng: number) => void;
	interactive?: boolean;
	controlsBelowHeader?: boolean;
}

export function ClubsMapWrapper(props: ClubsMapWrapperProps) {
	return <ClubsMap {...props} />;
}
