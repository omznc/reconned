"use client";

import dynamic from "next/dynamic";

export const MapViewer = dynamic(() => import("@/components/map-editor/map-viewer"), {
	ssr: false,
});
