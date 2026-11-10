"use client";

import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { LatLng } from "@/components/clubs-map/geo";

interface MapMarkerProps {
	map: MapLibreMap;
	position: LatLng;
	width: number;
	height: number;
	anchor: "bottom" | "center";
	zIndex?: number;
	/** A non-interactive marker lets clicks through to the map and the pins under it. */
	inert?: boolean;
	onClick?: () => void;
	onHover?: (hovered: boolean) => void;
	children: ReactNode;
}

/**
 * A React tree pinned to a coordinate. The marker element belongs to MapLibre, which
 * owns its `transform`; the pin motion lives on the children, so the two never fight.
 */
export function MapMarker({
	map,
	position,
	width,
	height,
	anchor,
	zIndex = 0,
	inert = false,
	onClick,
	onHover,
	children,
}: MapMarkerProps) {
	const [element] = useState(() => {
		const el = document.createElement("div");
		el.className = "map-marker";
		return el;
	});
	const [lat, lng] = position;

	useEffect(() => {
		const marker = new maplibregl.Marker({ element, anchor }).setLngLat([lng, lat]).addTo(map);
		return () => {
			marker.remove();
		};
	}, [map, element, anchor, lat, lng]);

	useEffect(() => {
		element.style.width = `${width}px`;
		element.style.height = `${height}px`;
		element.style.zIndex = String(zIndex);
		element.style.pointerEvents = inert ? "none" : "auto";
	}, [element, width, height, zIndex, inert]);

	if (!onClick) return createPortal(<div className="h-full w-full">{children}</div>, element);

	return createPortal(
		<button
			type="button"
			className="block h-full w-full cursor-pointer border-0 bg-transparent p-0 text-left"
			onClick={(event) => {
				// Otherwise the click also reaches the map and clears the selection it just made.
				event.stopPropagation();
				onClick();
			}}
			onMouseEnter={() => onHover?.(true)}
			onMouseLeave={() => onHover?.(false)}
		>
			{children}
		</button>,
		element,
	);
}
