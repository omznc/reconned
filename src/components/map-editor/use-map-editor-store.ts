"use client";

import type { Patch } from "immer";
import { applyPatches, enablePatches, produceWithPatches } from "immer";
import { create } from "zustand";

import type { BasemapId, EditorMode, FeatureStyle, LngLatTuple, MapFeature } from "@/components/map-editor/types";

enablePatches();

type HistoryEntry = {
	patches: Patch[];
	inverse: Patch[];
};

type MapFeatureUpdater = (feature: MapFeature) => MapFeature;

type EditorState = {
	features: MapFeature[];
	history: HistoryEntry[];
	future: HistoryEntry[];
	selectedId?: string;
	mode: EditorMode;
	gridVisible: boolean;
	gridLabelsVisible: boolean;
	gridOpacity: number;
	labelOpacity: number;
	basemap: BasemapId;
	pointIconName: string;
	style: FeatureStyle;
	setMode: (mode: EditorMode) => void;
	setStyle: (style: FeatureStyle) => void;
	setGridVisible: (value: boolean) => void;
	setGridLabelsVisible: (value: boolean) => void;
	setGridOpacity: (value: number) => void;
	setLabelOpacity: (value: number) => void;
	setBasemap: (value: BasemapId) => void;
	setPointIconName: (value: string) => void;
	setSelectedId: (id?: string) => void;
	addFeature: (feature: MapFeature) => void;
	updateFeature: (id: string, updater: MapFeatureUpdater) => void;
	deleteFeature: (id: string) => void;
	duplicateSelected: () => void;
	clear: () => void;
	undo: () => void;
	redo: () => void;
	replaceFeatures: (features: MapFeature[]) => void;
};

const defaultStyle: FeatureStyle = {
	strokeColor: "#ef4444",
	fillColor: "#f97316",
	strokeWidth: 2,
	fillOpacity: 0.4,
};

const applyChange = (
	state: EditorState,
	recipe: (draft: MapFeature[]) => void,
): { features: MapFeature[]; history: HistoryEntry[]; future: HistoryEntry[] } | null => {
	const [nextFeatures, patches, inverse] = produceWithPatches(state.features, (draft) => {
		recipe(draft);
	});
	if (patches.length === 0) {
		return null;
	}
	return {
		features: nextFeatures,
		history: [...state.history, { patches, inverse }],
		future: [],
	};
};

const cloneGeometry = (feature: MapFeature): MapFeature => {
	if (feature.geometry.type === "Point") {
		return {
			...feature,
			geometry: { type: "Point", coordinates: [...feature.geometry.coordinates] },
			iconName: feature.iconName,
			iconBackground: feature.iconBackground,
			iconSize: feature.iconSize,
		};
	}
	if (feature.geometry.type === "LineString") {
		const coordinates: LngLatTuple[] = [];
		for (const coordinate of feature.geometry.coordinates) {
			coordinates.push([coordinate[0], coordinate[1]]);
		}
		return { ...feature, geometry: { type: "LineString", coordinates } };
	}
	if (feature.geometry.type === "Polygon") {
		const rings: LngLatTuple[][] = [];
		for (const ring of feature.geometry.coordinates) {
			const copy: LngLatTuple[] = [];
			for (const coordinate of ring) {
				copy.push([coordinate[0], coordinate[1]]);
			}
			rings.push(copy);
		}
		return { ...feature, geometry: { type: "Polygon", coordinates: rings } };
	}
	if (feature.geometry.type === "Rectangle") {
		return {
			...feature,
			geometry: {
				type: "Rectangle",
				start: [feature.geometry.start[0], feature.geometry.start[1]],
				end: [feature.geometry.end[0], feature.geometry.end[1]],
			},
		};
	}
	if (feature.geometry.type === "Circle") {
		return {
			...feature,
			geometry: {
				type: "Circle",
				center: [feature.geometry.center[0], feature.geometry.center[1]],
				edge: feature.geometry.edge ? [feature.geometry.edge[0], feature.geometry.edge[1]] : null,
				radius: feature.geometry.radius,
			},
		};
	}
	const freehand: LngLatTuple[] = [];
	for (const coordinate of feature.geometry.coordinates) {
		freehand.push([coordinate[0], coordinate[1]]);
	}
	return { ...feature, geometry: { type: "Freehand", coordinates: freehand } };
};

export const useMapEditorStore = create<EditorState>((set, get) => ({
	features: [],
	history: [],
	future: [],
	selectedId: undefined,
	mode: "select",
	gridVisible: true,
	gridLabelsVisible: true,
	gridOpacity: 0.5,
	labelOpacity: 0.45,
	basemap: "osm",
	pointIconName: "map-pin",
	style: defaultStyle,
	setMode: (mode) => {
		set({ mode });
	},
	setStyle: (style) => {
		set({ style });
	},
	setGridVisible: (value) => {
		set({ gridVisible: value });
	},
	setGridLabelsVisible: (value) => {
		set({ gridLabelsVisible: value });
	},
	setGridOpacity: (value) => {
		set({ gridOpacity: value });
	},
	setLabelOpacity: (value) => {
		set({ labelOpacity: value });
	},
	setBasemap: (value) => {
		set({ basemap: value });
	},
	setPointIconName: (value) => {
		set({ pointIconName: value });
	},
	setSelectedId: (id) => {
		set({ selectedId: id });
	},
	addFeature: (feature) => {
		set((state) => {
			const applied = applyChange(state, (draft) => {
				draft.push(feature);
			});
			if (!applied) {
				return state;
			}
			return { ...applied, selectedId: feature.id };
		});
	},
	updateFeature: (id, updater) => {
		set((state) => {
			const applied = applyChange(state, (draft) => {
				let index = -1;
				for (let i = 0; i < draft.length; i += 1) {
					if (draft[i]?.id === id) {
						index = i;
						break;
					}
				}
				if (index === -1) {
					return;
				}
				// biome-ignore lint/style/noNonNullAssertion: A smarter me will fix this some day.
				draft[index] = updater(draft[index]!);
			});
			if (!applied) {
				return state;
			}
			return applied;
		});
	},
	deleteFeature: (id) => {
		set((state) => {
			const applied = applyChange(state, (draft) => {
				let index = -1;
				for (let i = 0; i < draft.length; i += 1) {
					if (draft[i]?.id === id) {
						index = i;
						break;
					}
				}
				if (index === -1) {
					return;
				}
				draft.splice(index, 1);
			});
			if (!applied) {
				return state;
			}
			return { ...applied, selectedId: state.selectedId === id ? undefined : state.selectedId };
		});
	},
	duplicateSelected: () => {
		const state = get();
		if (!state.selectedId) {
			return;
		}
		let found: MapFeature | undefined;
		for (const feature of state.features) {
			if (feature.id === state.selectedId) {
				found = feature;
				break;
			}
		}
		if (!found) {
			return;
		}
		const duplicate = cloneGeometry(found);
		duplicate.id = crypto.randomUUID();
		set((current) => {
			const applied = applyChange(current, (draft) => {
				draft.push(duplicate);
			});
			if (!applied) {
				return current;
			}
			return { ...applied, selectedId: duplicate.id };
		});
	},
	clear: () => {
		set({
			features: [],
			history: [],
			future: [],
			selectedId: undefined,
		});
	},
	undo: () => {
		set((state) => {
			const last = state.history[state.history.length - 1];
			if (!last) {
				return state;
			}
			const reverted = applyPatches(state.features, last.inverse);
			const history = state.history.slice(0, state.history.length - 1);
			const future = [...state.future, last];
			return { features: reverted, history, future };
		});
	},
	redo: () => {
		set((state) => {
			const last = state.future[state.future.length - 1];
			if (!last) {
				return state;
			}
			const advanced = applyPatches(state.features, last.patches);
			const future = state.future.slice(0, state.future.length - 1);
			const history = [...state.history, last];
			return { features: advanced, history, future };
		});
	},
	replaceFeatures: (features) => {
		const cloned: MapFeature[] = [];
		for (const feature of features) {
			cloned.push(cloneGeometry(feature));
		}
		set({
			features: cloned,
			history: [],
			future: [],
			selectedId: undefined,
		});
	},
}));
