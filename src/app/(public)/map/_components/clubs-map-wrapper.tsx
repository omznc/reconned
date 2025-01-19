"use client";

import dynamic from "next/dynamic";

const ClubsMap = dynamic(() => import("@/app/(public)/map/_components/clubs-map").then((mod) => mod.ClubsMap), {
    ssr: false,
});

interface Club {
    id: string;
    name: string;
    logo?: string | null;
    latitude: number | null;
    longitude: number | null;
    slug?: string | null;
}

interface ClubsMapWrapperProps {
    clubs: Club[];
    onLocationSelect?: (lat: number, lng: number) => void;
    interactive?: boolean;
}

export function ClubsMapWrapper(props: ClubsMapWrapperProps) {
    return <ClubsMap clubs={props.clubs} />;
}
