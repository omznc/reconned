"use client";

import dynamic from "next/dynamic";

export const MapEditor = dynamic(() => import("@/components/map-editor/map-editor"), {
	ssr: false,
});
