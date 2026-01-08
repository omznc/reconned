import type { BBox, Feature, FeatureCollection, Geometry } from "geojson";

import { DEFAULT_GRID, EMPTY_FEATURE_COLLECTION, MAP_DEFAULT_STYLE } from "@/components/map-editor/constants";
import { featuresToCollection } from "@/components/map-editor/geometry";
import type { MapEditorSnapshot, MapFeature, MapPlayArea } from "@/components/map-editor/types";

const cloneBbox = (bbox: FeatureCollection["bbox"]): BBox | undefined => {
	if (!bbox) {
		return undefined;
	}
	if (bbox.length === 4) {
		const [minLng, minLat, maxLng, maxLat] = bbox;
		return [minLng, minLat, maxLng, maxLat];
	}
	if (bbox.length === 6) {
		const [minLng, minLat, minAlt, maxLng, maxLat, maxAlt] = bbox;
		return [minLng, minLat, minAlt, maxLng, maxLat, maxAlt];
	}
	return undefined;
};

const cloneFeatureCollection = (collection: FeatureCollection): FeatureCollection => {
	const features: Feature[] = [];
	for (let index = 0; index < collection.features.length; index += 1) {
		const feature = collection.features[index];
		if (feature) {
			features.push(feature);
		}
	}
	const bbox = cloneBbox(collection.bbox);
	return { type: "FeatureCollection", features, bbox };
};

const isNumber = (value: unknown): value is number => {
	if (typeof value !== "number") {
		return false;
	}
	return Number.isFinite(value);
};

const isLngLatTuple = (value: unknown): value is [number, number] => {
	if (!Array.isArray(value) || value.length !== 2) {
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

const isLngLatRing = (value: unknown): value is [number, number][] => {
	if (!Array.isArray(value)) {
		return false;
	}
	for (let index = 0; index < value.length; index += 1) {
		if (!isLngLatTuple(value[index])) {
			return false;
		}
	}
	return true;
};

const isLngLatPolygon = (value: unknown): value is [number, number][][] => {
	if (!Array.isArray(value)) {
		return false;
	}
	for (let index = 0; index < value.length; index += 1) {
		if (!isLngLatRing(value[index])) {
			return false;
		}
	}
	return true;
};

const isPlayArea = (value: unknown): value is MapPlayArea => {
	if (!value || typeof value !== "object") {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	if (!isNumber(candidate.minLng) || !isNumber(candidate.maxLng)) {
		return false;
	}
	if (!isNumber(candidate.minLat) || !isNumber(candidate.maxLat)) {
		return false;
	}
	return true;
};

export const playAreaFromBbox = (bbox?: number[]): MapPlayArea | null => {
	if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) {
		return null;
	}
	const [minLng, minLat, maxLng, maxLat] = bbox;
	if (!isNumber(minLng) || !isNumber(minLat) || !isNumber(maxLng) || !isNumber(maxLat)) {
		return null;
	}
	return { minLng, maxLng, minLat, maxLat };
};

export const createEmptySnapshot = (): MapEditorSnapshot => {
	return {
		version: 2,
		collection: cloneFeatureCollection(EMPTY_FEATURE_COLLECTION),
		basemap: "osm",
		grid: { ...DEFAULT_GRID },
		playArea: null,
	};
};

const mapFeatureFromPolygon = (coordinates: [number, number][][]): MapFeature | null => {
	if (!isLngLatPolygon(coordinates)) {
		return null;
	}
	return {
		id: crypto.randomUUID(),
		kind: "polygon",
		geometry: { type: "Polygon", coordinates },
		style: { ...MAP_DEFAULT_STYLE },
	};
};

const mapFeatureFromPoint = (lng: number, lat: number): MapFeature => {
	return {
		id: crypto.randomUUID(),
		kind: "point",
		geometry: { type: "Point", coordinates: [lng, lat] },
		style: { ...MAP_DEFAULT_STYLE },
		iconName: "map-pin",
		iconBackground: true,
		iconSize: 22,
	};
};

const convertLegacyMapData = (input: unknown): MapEditorSnapshot | null => {
	if (!input || typeof input !== "object") {
		return null;
	}
	const data = input as { areas?: unknown; pois?: unknown };
	const features: MapFeature[] = [];
	if (Array.isArray(data.areas)) {
		for (let index = 0; index < data.areas.length; index += 1) {
			const ring = data.areas[index];
			if (isLngLatPolygon(ring)) {
				const feature = mapFeatureFromPolygon(ring);
				if (feature) {
					features.push(feature);
				}
			}
		}
	}
	if (Array.isArray(data.pois)) {
		for (let index = 0; index < data.pois.length; index += 1) {
			const poi = data.pois[index] as Record<string, unknown> | undefined;
			if (!poi) {
				continue;
			}
			const latValue = poi.lat;
			const lngValue = poi.lng;
			if (!isNumber(latValue) || !isNumber(lngValue)) {
				continue;
			}
			features.push(mapFeatureFromPoint(lngValue, latValue));
		}
	}
	const base = createEmptySnapshot();
	if (features.length === 0) {
		return base;
	}
	return {
		...base,
		collection: featuresToCollection(features),
	};
};

const sanitizeGeometry = (geometry: Geometry | null): Geometry | null => {
	if (!geometry) {
		return null;
	}
	if (geometry.type === "Point" || geometry.type === "LineString" || geometry.type === "Polygon") {
		return geometry;
	}
	return null;
};

const sanitizeFeatureCollection = (collection: FeatureCollection): FeatureCollection => {
	const features: Feature[] = [];
	for (let index = 0; index < collection.features.length; index += 1) {
		const feature = collection.features[index];
		if (!feature) {
			continue;
		}
		const geometry = sanitizeGeometry(feature.geometry);
		if (!geometry) {
			continue;
		}
		features.push({ ...feature, geometry });
	}
	const bbox = cloneBbox(collection.bbox);
	return { type: "FeatureCollection", features, bbox };
};

export const normalizeMapData = (input: unknown): MapEditorSnapshot => {
	const empty = createEmptySnapshot();
	if (!input || typeof input !== "object") {
		return empty;
	}
	const candidate = input as Partial<MapEditorSnapshot> & { areas?: unknown; pois?: unknown };
	if (candidate.version === 2 && candidate.collection) {
		const basemap = candidate.basemap === "satellite" ? "satellite" : "osm";
		const grid = {
			visible: candidate.grid?.visible || DEFAULT_GRID.visible,
			labelsVisible: candidate.grid?.labelsVisible || DEFAULT_GRID.labelsVisible,
			opacity: candidate.grid?.opacity || DEFAULT_GRID.opacity,
			labelOpacity: candidate.grid?.labelOpacity || DEFAULT_GRID.labelOpacity,
		};
		const collection = sanitizeFeatureCollection(candidate.collection);
		const playArea = isPlayArea(candidate.playArea)
			? candidate.playArea
			: playAreaFromBbox(candidate.collection.bbox);
		return {
			version: 2,
			collection,
			basemap,
			grid,
			playArea,
		};
	}
	const legacy = convertLegacyMapData(candidate);
	if (legacy) {
		return legacy;
	}
	return empty;
};

export const snapshotHasData = (snapshot: MapEditorSnapshot | null | undefined): boolean => {
	if (!snapshot) {
		return false;
	}
	if (snapshot.playArea) {
		return true;
	}
	return snapshot.collection.features.length > 0;
};
