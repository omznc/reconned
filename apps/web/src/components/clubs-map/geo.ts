export interface Point {
	x: number;
	y: number;
}

export type LatLng = [number, number];

const TILE = 256;
const EARTH_RADIUS_KM = 6371.0088;
const MAX_LAT = 85.0511287798;

/**
 * Zoom as the grouping code counts it: world width is 256 * 2^zoom pixels. MapLibre
 * draws a 512px world at zoom 0, so its zoom is one lower for the same scale.
 */
export const MAPLIBRE_ZOOM_SHIFT = 1;

export function toGroupingZoom(mapZoom: number): number {
	return mapZoom + MAPLIBRE_ZOOM_SHIFT;
}

export function toMapZoom(groupingZoom: number): number {
	return groupingZoom - MAPLIBRE_ZOOM_SHIFT;
}

/** Web Mercator, in world pixels at the given grouping zoom. */
export function project([lat, lng]: LatLng, zoom: number): Point {
	const scale = TILE * 2 ** zoom;
	const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
	const sin = Math.sin((clamped * Math.PI) / 180);
	return {
		x: ((lng + 180) / 360) * scale,
		y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
	};
}

export function unproject(point: Point, zoom: number): LatLng {
	const scale = TILE * 2 ** zoom;
	const lng = (point.x / scale) * 360 - 180;
	const n = Math.PI - (2 * Math.PI * point.y) / scale;
	const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
	return [lat, lng];
}

export function pixelDistance(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Great-circle distance in kilometres. */
export function distanceKm([latA, lngA]: LatLng, [latB, lngB]: LatLng): number {
	const rad = Math.PI / 180;
	const dLat = (latB - latA) * rad;
	const dLng = (lngB - lngA) * rad;
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(latA * rad) * Math.cos(latB * rad) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
