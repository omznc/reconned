"use client";

export type LngLatTuple = [number, number];

export type MapGeometry =
	| { type: "Point"; coordinates: LngLatTuple }
	| { type: "LineString"; coordinates: LngLatTuple[] }
	| { type: "Polygon"; coordinates: LngLatTuple[][] }
	| { type: "Rectangle"; start: LngLatTuple; end: LngLatTuple }
	| { type: "Circle"; center: LngLatTuple; edge: LngLatTuple | null; radius?: number }
	| { type: "Freehand"; coordinates: LngLatTuple[]; closed?: boolean };

export type MapFeatureKind = "point" | "line" | "polygon" | "rectangle" | "circle" | "freehand";

export type FeatureStyle = {
	strokeColor: string;
	fillColor: string;
	strokeWidth: number;
	fillOpacity: number;
};

export type MapFeature = {
	id: string;
	kind: MapFeatureKind;
	geometry: MapGeometry;
	style: FeatureStyle;
	label?: string;
	iconName?: string;
	iconBackground?: boolean;
	iconSize?: number;
};

export type EditorMode = "select" | "move" | MapFeatureKind;

export type BasemapId = "osm" | "satellite";
