"use client";

import type { Feature, FeatureCollection, Geometry, LineString, Point, Polygon } from "geojson";

import type { FeatureStyle, LngLatTuple, MapFeature, MapFeatureKind, MapGeometry } from "@/components/map-editor/types";

export type DraftState =
	| { type: "line"; points: LngLatTuple[] }
	| { type: "polygon"; points: LngLatTuple[] }
	| { type: "rectangle"; start: LngLatTuple; end: LngLatTuple }
	| { type: "circle"; center: LngLatTuple; edge: LngLatTuple | null }
	| { type: "freehand"; points: LngLatTuple[] }
	| null;

const earthRadius = 6371000;

const toRadians = (value: number): number => {
	return (value * Math.PI) / 180;
};

const toDegrees = (value: number): number => {
	return (value * 180) / Math.PI;
};

export const distanceMeters = (a: LngLatTuple, b: LngLatTuple): number => {
	const lat1 = toRadians(a[1]);
	const lat2 = toRadians(b[1]);
	const deltaLat = lat2 - lat1;
	const deltaLng = toRadians(b[0] - a[0]);
	const sinLat = Math.sin(deltaLat / 2);
	const sinLng = Math.sin(deltaLng / 2);
	const inside = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
	const central = 2 * Math.atan2(Math.sqrt(inside), Math.sqrt(1 - inside));
	return earthRadius * central;
};

const destination = (origin: LngLatTuple, distance: number, bearing: number): LngLatTuple => {
	const lat1 = toRadians(origin[1]);
	const lng1 = toRadians(origin[0]);
	const angularDistance = distance / earthRadius;
	const bearingRad = toRadians(bearing);
	const lat2 = Math.asin(
		Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad),
	);
	const lng2 =
		lng1 +
		Math.atan2(
			Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
			Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
		);
	return [toDegrees(lng2), toDegrees(lat2)];
};

const rectangleRing = (start: LngLatTuple, end: LngLatTuple): LngLatTuple[] => {
	const minLng = Math.min(start[0], end[0]);
	const maxLng = Math.max(start[0], end[0]);
	const minLat = Math.min(start[1], end[1]);
	const maxLat = Math.max(start[1], end[1]);
	return [
		[minLng, minLat],
		[maxLng, minLat],
		[maxLng, maxLat],
		[minLng, maxLat],
		[minLng, minLat],
	];
};

export const circlePolygon = (center: LngLatTuple, radius: number, steps = 128): LngLatTuple[] => {
	const coords: LngLatTuple[] = [];
	const step = 360 / steps;
	let bearing = 0;
	while (bearing <= 360) {
		coords.push(destination(center, radius, bearing));
		bearing += step;
	}
	return coords;
};

const geometryToGeoJSON = (geometry: MapGeometry): Point | LineString | Polygon => {
	if (geometry.type === "Point") {
		return { type: "Point", coordinates: geometry.coordinates };
	}
	if (geometry.type === "LineString") {
		return { type: "LineString", coordinates: geometry.coordinates };
	}
	if (geometry.type === "Polygon") {
		return { type: "Polygon", coordinates: geometry.coordinates };
	}
	if (geometry.type === "Rectangle") {
		return { type: "Polygon", coordinates: [rectangleRing(geometry.start, geometry.end)] };
	}
	if (geometry.type === "Circle") {
		const edge = geometry.edge ?? geometry.center;
		const radius = geometry.radius ?? distanceMeters(geometry.center, edge);
		return { type: "Polygon", coordinates: [circlePolygon(geometry.center, radius)] };
	}
	if (geometry.type === "Freehand" && geometry.closed) {
		const coords = [...geometry.coordinates];
		if (coords.length > 0) {
			const first = coords[0];
			const last = coords[coords.length - 1];
			if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
				coords.push([first[0], first[1]]);
			}
		}
		return { type: "Polygon", coordinates: [coords] };
	}
	return { type: "LineString", coordinates: geometry.coordinates };
};

export const featureToGeoJSON = (feature: MapFeature): Feature => {
	const geometry = geometryToGeoJSON(feature.geometry);
	return {
		type: "Feature",
		geometry,
		properties: {
			id: feature.id,
			kind: feature.kind,
			strokeColor: feature.style.strokeColor,
			strokeWidth: feature.style.strokeWidth,
			fillColor: feature.style.fillColor,
			fillOpacity: feature.style.fillOpacity,
			label: feature.label ?? "",
			iconName: feature.iconName ?? "",
			iconBackground: feature.iconBackground ?? true,
			iconSize: feature.iconSize ?? 22,
		},
	};
};

export const featuresToCollection = (features: MapFeature[]): FeatureCollection => {
	const items: Feature[] = [];
	for (const feature of features) {
		items.push(featureToGeoJSON(feature));
	}
	return {
		type: "FeatureCollection",
		features: items,
	};
};

export const draftToCollection = (draft: DraftState, hover: LngLatTuple | null): FeatureCollection => {
	if (!draft) {
		return { type: "FeatureCollection", features: [] };
	}
	if (draft.type === "rectangle") {
		const end = hover ?? draft.end;
		return {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					geometry: { type: "Polygon", coordinates: [rectangleRing(draft.start, end)] },
					properties: {},
				},
			],
		};
	}
	if (draft.type === "circle") {
		const edge = hover ?? draft.edge ?? draft.center;
		const radius = distanceMeters(draft.center, edge);
		return {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					geometry: { type: "Polygon", coordinates: [circlePolygon(draft.center, radius)] },
					properties: {},
				},
			],
		};
	}
	if (draft.type === "freehand") {
		return {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					geometry: { type: "LineString", coordinates: draft.points },
					properties: {},
				},
			],
		};
	}
	const points: LngLatTuple[] = [];
	for (const point of draft.points) {
		points.push(point);
	}
	if (hover) {
		points.push(hover);
	}
	if (draft.type === "line") {
		return {
			type: "FeatureCollection",
			features: [{ type: "Feature", geometry: { type: "LineString", coordinates: points }, properties: {} }],
		};
	}
	if (draft.type === "polygon") {
		if (points.length === 1 && hover) {
			return {
				type: "FeatureCollection",
				features: [{ type: "Feature", geometry: { type: "LineString", coordinates: points }, properties: {} }],
			};
		}
		if (points.length < 2) {
			return { type: "FeatureCollection", features: [] };
		}
		const firstPoint = points[0];
		if (!firstPoint) {
			return { type: "FeatureCollection", features: [] };
		}
		const ring = [...points, firstPoint];
		return {
			type: "FeatureCollection",
			features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} }],
		};
	}
	return { type: "FeatureCollection", features: [] };
};

const isNumber = (value: unknown): value is number => {
	if (typeof value !== "number") {
		return false;
	}
	return Number.isFinite(value);
};

const isLngLat = (value: unknown): value is LngLatTuple => {
	if (!Array.isArray(value)) {
		return false;
	}
	if (value.length !== 2) {
		return false;
	}
	if (!isNumber(value[0])) {
		return false;
	}
	if (!isNumber(value[1])) {
		return false;
	}
	return true;
};

const isLngLatArray = (value: unknown): value is LngLatTuple[] => {
	if (!Array.isArray(value)) {
		return false;
	}
	for (const item of value) {
		if (!isLngLat(item)) {
			return false;
		}
	}
	return true;
};

const isLngLatRings = (value: unknown): value is LngLatTuple[][] => {
	if (!Array.isArray(value)) {
		return false;
	}
	for (const ring of value) {
		if (!isLngLatArray(ring)) {
			return false;
		}
	}
	return true;
};

const geometryFromGeoJSON = (geometry: Geometry | null): MapGeometry | null => {
	if (!geometry) {
		return null;
	}
	if (geometry.type === "Point" && isLngLat(geometry.coordinates)) {
		return { type: "Point", coordinates: geometry.coordinates };
	}
	if (geometry.type === "LineString" && isLngLatArray(geometry.coordinates)) {
		return { type: "LineString", coordinates: geometry.coordinates };
	}
	if (geometry.type === "Polygon" && isLngLatRings(geometry.coordinates)) {
		return { type: "Polygon", coordinates: geometry.coordinates };
	}
	return null;
};

const normalizeStyle = (properties: Record<string, unknown>, fallback: FeatureStyle): FeatureStyle => {
	const strokeColor = typeof properties.strokeColor === "string" ? properties.strokeColor : fallback.strokeColor;
	const fillColor = typeof properties.fillColor === "string" ? properties.fillColor : fallback.fillColor;
	const strokeWidth = isNumber(properties.strokeWidth) ? properties.strokeWidth : fallback.strokeWidth;
	const fillOpacityValue = isNumber(properties.fillOpacity) ? properties.fillOpacity : fallback.fillOpacity;
	const fillOpacity = Math.min(Math.max(fillOpacityValue, 0), 1);
	return {
		strokeColor,
		fillColor,
		strokeWidth,
		fillOpacity,
	};
};

type FeatureImportDefaults = {
	style: FeatureStyle;
	iconName: string;
	iconBackground: boolean;
	iconSize: number;
};

export const collectionToFeatures = (collection: FeatureCollection, defaults: FeatureImportDefaults): MapFeature[] => {
	const imported: MapFeature[] = [];
	for (const item of collection.features) {
		const geometry = geometryFromGeoJSON(item.geometry);
		if (!geometry) {
			continue;
		}
		const properties = (item.properties ?? {}) as Record<string, unknown>;
		const style = normalizeStyle(properties, defaults.style);
		const idValue = properties.id;
		const labelValue = properties.label;
		const iconNameValue = properties.iconName;
		const iconBackgroundValue = properties.iconBackground;
		const iconSizeValue = properties.iconSize;
		const id = typeof idValue === "string" && idValue.length > 0 ? idValue : crypto.randomUUID();
		const label = typeof labelValue === "string" && labelValue.length > 0 ? labelValue : undefined;
		const iconName =
			typeof iconNameValue === "string" && iconNameValue.length > 0 ? iconNameValue : defaults.iconName;
		const iconBackground = typeof iconBackgroundValue === "boolean" ? iconBackgroundValue : defaults.iconBackground;
		const iconSize = isNumber(iconSizeValue) ? iconSizeValue : defaults.iconSize;
		let kind: MapFeatureKind = "polygon";
		if (geometry.type === "Point") {
			kind = "point";
		} else if (geometry.type === "LineString") {
			kind = "line";
		}
		imported.push({
			id,
			kind,
			geometry,
			style,
			label,
			iconName,
			iconBackground,
			iconSize,
		});
	}
	return imported;
};
