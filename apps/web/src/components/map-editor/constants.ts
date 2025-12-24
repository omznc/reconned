import type { FeatureCollection } from "geojson";

import type { FeatureStyle, MapEditorSnapshot } from "@/components/map-editor/types";

export const MAP_DEFAULT_STYLE: FeatureStyle = {
	strokeColor: "#ef4444",
	fillColor: "#f97316",
	strokeWidth: 2,
	fillOpacity: 0.4,
};

export const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
	type: "FeatureCollection",
	features: [],
};

export const DEFAULT_GRID = {
	visible: true,
	labelsVisible: true,
	opacity: 0.5,
	labelOpacity: 0.45,
};

export const EMPTY_SNAPSHOT: MapEditorSnapshot = {
	version: 2,
	collection: EMPTY_FEATURE_COLLECTION,
	basemap: "osm",
	grid: DEFAULT_GRID,
	playArea: null,
};
