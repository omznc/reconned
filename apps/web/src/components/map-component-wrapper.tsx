"use client";

import dynamic from "next/dynamic";

export const MapComponent = dynamic(() => import("@/components/map-component"), {
	ssr: false,
});
