import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import { type RefObject, useEffect, useRef, useState } from "react";
import { type LatLng, toMapZoom } from "@/components/clubs-map/geo";
import { MAX_ZOOM } from "@/components/clubs-map/grouping";

// OpenFreeMap: free, no key. The styles carry their own attribution.
const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

interface InitialView {
	center: LatLng;
	/** In grouping zoom, see geo.ts. */
	zoom: number;
}

/**
 * Creates the map in the container once the theme is known, and swaps the base
 * style when the theme changes. Markers are DOM elements, so they survive a style
 * swap on their own.
 */
export function useMapLibre(container: RefObject<HTMLDivElement | null>, initial: InitialView) {
	const { resolvedTheme } = useTheme();
	const styleUrl = resolvedTheme === "dark" ? STYLE_DARK : STYLE_LIGHT;
	const themeReady = resolvedTheme !== undefined;
	const [map, setMap] = useState<MapLibreMap | null>(null);
	const latest = useRef({ initial, styleUrl });
	latest.current = { initial, styleUrl };
	const appliedStyle = useRef<string | null>(null);

	useEffect(() => {
		const element = container.current;
		if (!themeReady || !element) return;

		const { initial: view, styleUrl: style } = latest.current;
		appliedStyle.current = style;
		const created = new maplibregl.Map({
			container: element,
			style,
			center: [view.center[1], view.center[0]],
			zoom: toMapZoom(view.zoom),
			maxZoom: toMapZoom(MAX_ZOOM),
			dragRotate: false,
			attributionControl: { compact: true },
		});
		created.touchZoomRotate.disableRotation();
		created.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
		setMap(created);

		return () => {
			created.remove();
			setMap(null);
		};
	}, [container, themeReady]);

	useEffect(() => {
		if (!map || appliedStyle.current === styleUrl) return;
		appliedStyle.current = styleUrl;
		// No diff: the fan layers are not part of either style and would be dropped by one.
		map.setStyle(styleUrl);
	}, [map, styleUrl]);

	return { map, dark: resolvedTheme === "dark" };
}
