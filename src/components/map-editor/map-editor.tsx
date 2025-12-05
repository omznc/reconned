"use client";

import type { LucideIcon } from "lucide-react";
import { Circle, FileDown, Loader, MousePointer2, Move3d, PencilLine, Shapes, Square, X } from "lucide-react";
import { iconNames } from "lucide-react/dynamic";
import maplibregl, { type GeoJSONSource, type LngLat, type Map as MapLibreMap, type MapMouseEvent } from "maplibre-gl";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { BBox, FeatureCollection } from "geojson";
import { useTranslations } from "next-intl";
import { createRoot, type Root } from "react-dom/client";
import { EditorControlsPanel } from "@/components/map-editor/_components/editor-controls-panel";
import { EditorSelectionPanel } from "@/components/map-editor/_components/editor-selection-panel";
import { EditorTopbar } from "@/components/map-editor/_components/editor-topbar";
import { PointMarker } from "@/components/map-editor/_components/point-marker";
import type { DraftState } from "@/components/map-editor/geometry";
import {
	collectionToFeatures,
	distanceMeters,
	draftToCollection,
	featuresToCollection,
	featureToGeoJSON,
} from "@/components/map-editor/geometry";
import type {
	BasemapId,
	EditorMode,
	FeatureStyle,
	LngLatTuple,
	MapFeature,
	MapFeatureKind,
} from "@/components/map-editor/types";
import { useMapEditorStore } from "@/components/map-editor/use-map-editor-store";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ModeButton = {
	mode: EditorMode;
	icon: LucideIcon;
	label: string;
};

const baseStyle = {
	version: 8,
	sources: {
		osm: {
			type: "raster",
			tiles: [
				"https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
				"https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
				"https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
			],
			tileSize: 256,
			attribution: "© OpenStreetMap",
		},
	},
	layers: [
		{
			id: "osm",
			type: "raster",
			source: "osm",
		},
	],
} satisfies maplibregl.StyleSpecification;

const emptyCollection: FeatureCollection = { type: "FeatureCollection", features: [] };

type MapEditorProps = {
	visible?: boolean;
	onClose?: () => void;
};

export function MapEditor({ visible = false, onClose }: MapEditorProps) {
	const t = useTranslations();
	const {
		features,
		addFeature,
		updateFeature,
		deleteFeature,
		duplicateSelected,
		undo,
		redo,
		setMode,
		mode,
		selectedId,
		setSelectedId,
		gridVisible,
		setGridVisible,
		style,
		setStyle,
		clear,
		replaceFeatures,
		history,
		future,
	} = useMapEditorStore();
	const mapRef = useRef<MapLibreMap | null>(null);
	const mapContainerRef = useRef<HTMLDivElement | null>(null);
	const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const draftRef = useRef<DraftState>(null);
	const [draft, setDraft] = useState<DraftState>(null);
	const [hoverPoint, setHoverPoint] = useState<LngLatTuple | null>(null);
	const [snapPoint, setSnapPoint] = useState<LngLatTuple | null>(null);
	const [gridLabelsVisible, setGridLabelsVisible] = useState(true);
	const [gridOpacity, setGridOpacity] = useState(1);
	const [labelOpacity, setLabelOpacity] = useState(1);
	const [helpOpen, setHelpOpen] = useState(false);
	const [statsOpen, setStatsOpen] = useState(false);
	const [gridRef, setGridRef] = useState<{ cell: string; lat: string; lng: string }>({
		cell: "",
		lat: "",
		lng: "",
	});
	const [playArea, setPlayArea] = useState<{ minLng: number; maxLng: number; minLat: number; maxLat: number } | null>(
		null,
	);
	const [isSettingPlayArea, setIsSettingPlayArea] = useState(true);
	const [playAreaConfirmed, setPlayAreaConfirmed] = useState(false);
	const hasPlayArea = Boolean(playArea);
	useEffect(() => {
		if (visible) {
			const prev = document.body.style.overflow;
			document.body.style.overflow = "hidden";
			return () => {
				document.body.style.overflow = prev;
			};
		}
		return;
	}, [visible]);
	const [mapReady, setMapReady] = useState(false);
	const [isFreehandDrawing, setIsFreehandDrawing] = useState(false);
	const importRef = useRef<HTMLInputElement | null>(null);
	const pointIconRef = useRef<string>("map-pin");
	const markersRef = useRef<Map<string, { marker: maplibregl.Marker; root: Root; size: number }>>(new Map());
	const previousPlayAreaRef = useRef<{ minLng: number; maxLng: number; minLat: number; maxLat: number } | null>(null);
	const draggingRef = useRef<{
		id: string;
		last: LngLatTuple;
	} | null>(null);
	const strokeRafRef = useRef<number | null>(null);
	const fillRafRef = useRef<number | null>(null);
	const appliedStyle = useMemo(() => {
		return style;
	}, [style]);
	const [strokeColorInput, setStrokeColorInput] = useState<string>(appliedStyle.strokeColor);
	const [fillColorInput, setFillColorInput] = useState<string>(appliedStyle.fillColor);
	const [iconSizeInput, setIconSizeInput] = useState<number>(22);
	const [overlaySize, setOverlaySize] = useState<number>(0);
	const sidebarIconSize = 22;
	const basemapOptions = useMemo<{ id: BasemapId; label: string }[]>(
		() => [
			{ id: "osm", label: t("testMap.basemap.osm") },
			{ id: "satellite", label: t("testMap.basemap.satellite") },
		],
		[t],
	);
	const [basemap, setBasemap] = useState<BasemapId>("osm");
	const confirm = useConfirm();
	const modeButtons = useMemo<ModeButton[]>(() => {
		return [
			{ mode: "select", icon: MousePointer2, label: t("testMap.modes.select") },
			{ mode: "move", icon: Move3d, label: t("testMap.modes.move") },
			{ mode: "point", icon: X, label: t("testMap.modes.point") },
			{ mode: "line", icon: PencilLine, label: t("testMap.modes.line") },
			{ mode: "polygon", icon: Shapes, label: t("testMap.modes.polygon") },
			{ mode: "rectangle", icon: Square, label: t("testMap.modes.rectangle") },
			{ mode: "circle", icon: Circle, label: t("testMap.modes.circle") },
			{ mode: "freehand", icon: PencilLine, label: t("testMap.modes.freehand") },
		];
	}, [t]);
	const keybinds = useMemo(
		() => [
			{ action: t("testMap.keybinds.items.undo.action"), shortcut: t("testMap.keybinds.items.undo.shortcut") },
			{ action: t("testMap.keybinds.items.redo.action"), shortcut: t("testMap.keybinds.items.redo.shortcut") },
			{
				action: t("testMap.keybinds.items.delete.action"),
				shortcut: t("testMap.keybinds.items.delete.shortcut"),
			},
			{
				action: t("testMap.keybinds.items.duplicate.action"),
				shortcut: t("testMap.keybinds.items.duplicate.shortcut"),
			},
			{
				action: t("testMap.keybinds.items.finish.action"),
				shortcut: t("testMap.keybinds.items.finish.shortcut"),
			},
			{
				action: t("testMap.keybinds.items.cancel.action"),
				shortcut: t("testMap.keybinds.items.cancel.shortcut"),
			},
			{
				action: t("testMap.keybinds.items.shiftDrag.action"),
				shortcut: t("testMap.keybinds.items.shiftDrag.shortcut"),
			},
		],
		[t],
	);

	const updateDraft = (next: DraftState) => {
		draftRef.current = next;
		setDraft(next);
	};

	const projectPoint = (lngLat: LngLat): { x: number; y: number } | null => {
		const map = mapRef.current;
		if (!map) {
			return null;
		}
		const point = map.project(lngLat);
		return { x: point.x, y: point.y };
	};

	const createFeature = (kind: MapFeatureKind, geometry: MapFeature["geometry"]): MapFeature => {
		return {
			id: crypto.randomUUID(),
			kind,
			geometry,
			style: appliedStyle,
			iconName: pointIconRef.current,
			iconBackground: true,
			iconSize: 22,
		};
	};

	const addGeometryFeature = (kind: MapFeatureKind, geometry: MapFeature["geometry"]) => {
		addFeature(createFeature(kind, geometry));
	};

	const finalizeLine = (points: LngLatTuple[]) => {
		if (points.length < 2) {
			return;
		}
		addGeometryFeature("line", { type: "LineString", coordinates: points });
		updateDraft(null);
		setHoverPoint(null);
		setSnapPoint(null);
	};

	const finalizePolygon = (points: LngLatTuple[]) => {
		if (points.length < 3) {
			return;
		}
		const firstPoint = points[0];
		if (!firstPoint) {
			return;
		}
		const ring = [...points, firstPoint];
		addGeometryFeature("polygon", { type: "Polygon", coordinates: [ring] });
		updateDraft(null);
		setHoverPoint(null);
	};

	const handleSelect = (event: MapMouseEvent) => {
		const map = mapRef.current;
		if (!map) {
			return;
		}
		const featuresAtPoint = map.queryRenderedFeatures(event.point, {
			layers: ["editor-fill", "editor-line", "editor-point", "editor-point-hit"],
		});
		if (featuresAtPoint.length === 0) {
			setSelectedId(undefined);
			return;
		}
		const first = featuresAtPoint[0];
		if (!first) {
			setSelectedId(undefined);
			return;
		}
		if (typeof first.properties?.id !== "string") {
			setSelectedId(undefined);
			return;
		}
		setSelectedId(first.properties.id);
	};

	const handleClick = (event: MapMouseEvent) => {
		const coordinate: LngLatTuple = [event.lngLat.lng, event.lngLat.lat];
		const snapped = snapPoint ?? hoverPoint;
		const finalCoordinate = snapped ?? coordinate;
		if (isSettingPlayArea) {
			return;
		}
		if (mode === "select") {
			handleSelect(event);
			return;
		}
		if (mode === "point") {
			addGeometryFeature("point", { type: "Point", coordinates: finalCoordinate });
			return;
		}
		if (mode === "line") {
			if (!draft || draft.type !== "line") {
				updateDraft({ type: "line", points: [finalCoordinate] });
				return;
			}
			const nextPoints = [...draft.points, finalCoordinate];
			if (draft.points.length >= 1) {
				finalizeLine(nextPoints);
				return;
			}
			updateDraft({ type: "line", points: nextPoints });
			return;
		}
		if (mode === "polygon") {
			if (!draft || draft.type !== "polygon") {
				updateDraft({ type: "polygon", points: [finalCoordinate] });
				return;
			}
			const firstPoint = draft.points[0];
			if (firstPoint && snapped && snapped[0] === firstPoint[0] && snapped[1] === firstPoint[1]) {
				finalizePolygon(draft.points);
				return;
			}
			updateDraft({ type: "polygon", points: [...draft.points, finalCoordinate] });
			return;
		}
		if (mode === "rectangle") {
			if (!draft || draft.type !== "rectangle") {
				updateDraft({ type: "rectangle", start: coordinate, end: coordinate });
				return;
			}
			addGeometryFeature("rectangle", { type: "Rectangle", start: draft.start, end: coordinate });
			updateDraft(null);
			return;
		}
		if (mode === "circle") {
			if (!draft || draft.type !== "circle") {
				updateDraft({ type: "circle", center: coordinate, edge: coordinate });
				return;
			}
			addGeometryFeature("circle", { type: "Circle", center: draft.center, edge: coordinate });
			updateDraft(null);
			return;
		}
	};

	const handleDoubleClick = (event: MapMouseEvent) => {
		const coordinate: LngLatTuple = [event.lngLat.lng, event.lngLat.lat];
		if (mode === "line" && draft && draft.type === "line") {
			event.preventDefault();
			finalizeLine(draft.points);
			return;
		}
		if (mode === "polygon" && draft && draft.type === "polygon") {
			event.preventDefault();
			const points = [...draft.points];
			points.push(coordinate);
			finalizePolygon(points);
		}
	};

	const handleMouseMove = (event: MapMouseEvent) => {
		const coordinate: LngLatTuple = [event.lngLat.lng, event.lngLat.lat];
		const map = mapRef.current;
		if (map && playArea) {
			const topLeft = map.project([playArea.minLng, playArea.maxLat]);
			const bottomRight = map.project([playArea.maxLng, playArea.minLat]);
			const width = bottomRight.x - topLeft.x;
			const height = bottomRight.y - topLeft.y;
			const sizePx = Math.min(width, height);
			const offsetX = (width - sizePx) / 2;
			const offsetY = (height - sizePx) / 2;
			const left = topLeft.x + offsetX;
			const top = topLeft.y + offsetY;
			const right = left + sizePx;
			const bottom = top + sizePx;
			const cellPx = sizePx / 10;
			const subPx = cellPx / 3;
			const pt = map.project(event.lngLat);
			const inBounds = pt.x >= left && pt.x <= right && pt.y >= top && pt.y <= bottom;
			if (inBounds) {
				const col = Math.floor((pt.x - left) / cellPx);
				const row = Math.floor((pt.y - top) / cellPx);
				const subCol = Math.floor(((pt.x - left) % cellPx) / subPx);
				const subRow = Math.floor(((pt.y - top) % cellPx) / subPx);
				if (
					row >= 0 &&
					row < 10 &&
					col >= 0 &&
					col < 10 &&
					subRow >= 0 &&
					subRow < 3 &&
					subCol >= 0 &&
					subCol < 3
				) {
					const cellLabel = `${toLetters(row)}${col + 1}`;
					const subIndex = subRow * 3 + subCol + 1;
					setGridRef({
						cell: `${cellLabel}-${subIndex}`,
						lat: formatCoordShort(coordinate[1], true),
						lng: formatCoordShort(coordinate[0], false),
					});
				} else {
					setGridRef({ cell: "", lat: "", lng: "" });
				}
			} else {
				setGridRef({ cell: "", lat: "", lng: "" });
			}
		} else {
			setGridRef({ cell: "", lat: "", lng: "" });
		}
		if (isSettingPlayArea) {
			return;
		}
		if (draggingRef.current) {
			const drag = draggingRef.current;
			const delta: LngLatTuple = [coordinate[0] - drag.last[0], coordinate[1] - drag.last[1]];
			applyTranslation(drag.id, delta);
			draggingRef.current = { ...drag, last: coordinate };
			return;
		}
		if (draft && (draft.type === "rectangle" || draft.type === "circle")) {
			updateDraft(
				draft.type === "rectangle"
					? { type: "rectangle", start: draft.start, end: coordinate }
					: { type: "circle", center: draft.center, edge: coordinate },
			);
			return;
		}
		if (draft && (draft.type === "line" || draft.type === "polygon")) {
			const snapped = findSnapPoint(event.lngLat);
			setSnapPoint(snapped);
			setHoverPoint(snapped ?? coordinate);
			return;
		}
		if (mode === "freehand" && isFreehandDrawing && draft && draft.type === "freehand") {
			const lastPoint = draft.points[draft.points.length - 1];
			if (!lastPoint) {
				return;
			}
			const lastProjected = projectPoint({ lng: lastPoint[0], lat: lastPoint[1] } as LngLat);
			const currentProjected = projectPoint(event.lngLat);
			if (!lastProjected || !currentProjected) {
				return;
			}
			const dx = currentProjected.x - lastProjected.x;
			const dy = currentProjected.y - lastProjected.y;
			if (Math.sqrt(dx * dx + dy * dy) < 4) {
				return;
			}
			const nextPoints = [...draft.points, coordinate];
			updateDraft({ type: "freehand", points: nextPoints });
		}
	};

	const handleMouseDown = (event: MapMouseEvent) => {
		if (isSettingPlayArea) {
			return;
		}
		if (isSettingPlayArea) {
			const map = mapRef.current;
			if (map) {
				map.dragPan.enable();
			}
			return;
		}
		if (playAreaConfirmed && mode === "freehand") {
			const coordinate: LngLatTuple = [event.lngLat.lng, event.lngLat.lat];
			updateDraft({ type: "freehand", points: [coordinate] });
			setIsFreehandDrawing(true);
			const map = mapRef.current;
			if (map) {
				map.dragPan.disable();
			}
			return;
		}
		if (mode === "select" || mode === "move") {
			const hitId = hitTest(event.point);
			if (hitId) {
				setSelectedId(hitId);
				draggingRef.current = { id: hitId, last: [event.lngLat.lng, event.lngLat.lat] };
				const map = mapRef.current;
				if (map) {
					map.dragPan.disable();
				}
			}
		}
	};

	const handleMouseUp = () => {
		if (isSettingPlayArea) {
			return;
		}
		if (mode === "freehand") {
			if (draft && draft.type === "freehand" && draft.points.length > 1) {
				const closeToStart = isCloseToStart(draft.points);
				addGeometryFeature("freehand", { type: "Freehand", coordinates: draft.points, closed: closeToStart });
			}
			setIsFreehandDrawing(false);
			updateDraft(null);
			setSnapPoint(null);
			setHoverPoint(null);
		}
		if (draggingRef.current) {
			draggingRef.current = null;
		}
		const map = mapRef.current;
		if (map) {
			map.dragPan.enable();
		}
	};

	const finishDraft = () => {
		if (!draft) {
			return;
		}
		if (draft.type === "line") {
			finalizeLine(draft.points);
			return;
		}
		if (draft.type === "polygon") {
			finalizePolygon(draft.points);
		}
	};

	const isCloseToStart = (points: LngLatTuple[]) => {
		if (points.length < 2) {
			return false;
		}
		const first = points[0];
		const last = points[points.length - 1];
		if (!first || !last) {
			return false;
		}
		return Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.0005;
	};

	const hitTest = (point: maplibregl.PointLike): string | undefined => {
		const map = mapRef.current;
		if (!map) {
			return undefined;
		}
		const featuresAtPoint = map.queryRenderedFeatures(point, {
			layers: ["editor-fill", "editor-line", "editor-point", "editor-point-hit"],
		});
		const first = featuresAtPoint[0];
		if (first && typeof first.properties?.id === "string") {
			return first.properties.id;
		}
		return undefined;
	};

	const applyTranslation = (id: string, delta: LngLatTuple) => {
		updateFeature(id, (feature) => {
			const { geometry: current } = feature;
			if (current.type === "Point") {
				return {
					...feature,
					geometry: {
						type: "Point",
						coordinates: [current.coordinates[0] + delta[0], current.coordinates[1] + delta[1]],
					},
				};
			}
			if (current.type === "LineString") {
				const coords: LngLatTuple[] = current.coordinates.map((coord) => [
					coord[0] + delta[0],
					coord[1] + delta[1],
				]);
				return { ...feature, geometry: { type: "LineString", coordinates: coords } };
			}
			if (current.type === "Polygon") {
				const rings = current.coordinates.map((ring) =>
					ring.map((coord) => [coord[0] + delta[0], coord[1] + delta[1]] as LngLatTuple),
				);
				return { ...feature, geometry: { type: "Polygon", coordinates: rings } };
			}
			if (current.type === "Rectangle") {
				return {
					...feature,
					geometry: {
						type: "Rectangle",
						start: [current.start[0] + delta[0], current.start[1] + delta[1]],
						end: [current.end[0] + delta[0], current.end[1] + delta[1]],
					},
				};
			}
			if (current.type === "Circle") {
				return {
					...feature,
					geometry: {
						type: "Circle",
						center: [current.center[0] + delta[0], current.center[1] + delta[1]],
						edge: current.edge ? [current.edge[0] + delta[0], current.edge[1] + delta[1]] : null,
						radius: current.radius,
					},
				};
			}
			const coords: LngLatTuple[] = current.coordinates.map((coord) => [
				coord[0] + delta[0],
				coord[1] + delta[1],
			]);
			return { ...feature, geometry: { type: "Freehand", coordinates: coords } };
		});
	};

	const lengthOfCoordinates = (coordinates: LngLatTuple[]): number => {
		let total = 0;
		for (let index = 1; index < coordinates.length; index += 1) {
			const previous = coordinates[index - 1];
			const current = coordinates[index];
			if (!previous || !current) {
				continue;
			}
			total += distanceMeters(previous, current);
		}
		return total;
	};

	const mapLayersReady = () => {
		const map = mapRef.current;
		if (!map) {
			return;
		}
		map.addSource("basemap-osm", {
			type: "raster",
			tiles: [
				"https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
				"https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
				"https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
			],
			tileSize: 256,
			attribution: "© OpenStreetMap",
		});
		map.addSource("basemap-satellite", {
			type: "raster",
			tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
			tileSize: 256,
			maxzoom: 19,
			attribution: "© Esri, Maxar, Earthstar Geographics",
		});
		map.addLayer({
			id: "basemap-osm",
			type: "raster",
			source: "basemap-osm",
		});
		map.addLayer({
			id: "basemap-satellite",
			type: "raster",
			source: "basemap-satellite",
			layout: { visibility: "none" },
		});
		map.addSource("editor-features", {
			type: "geojson",
			data: emptyCollection,
		});
		map.addSource("editor-draft", {
			type: "geojson",
			data: emptyCollection,
		});
		map.addLayer({
			id: "editor-fill",
			type: "fill",
			source: "editor-features",
			filter: ["==", ["geometry-type"], "Polygon"],
			paint: {
				"fill-color": ["coalesce", ["get", "fillColor"], "#f97316"],
				"fill-opacity": ["coalesce", ["get", "fillOpacity"], 0.4],
			},
		});
		map.addLayer({
			id: "editor-line",
			type: "line",
			source: "editor-features",
			filter: ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "LineString"]],
			paint: {
				"line-color": ["coalesce", ["get", "strokeColor"], "#ef4444"],
				"line-width": ["coalesce", ["get", "strokeWidth"], 2],
			},
		});
		map.addLayer({
			id: "editor-point",
			type: "circle",
			source: "editor-features",
			filter: ["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "iconName"], ""]],
			paint: {
				"circle-radius": 6,
				"circle-color": ["coalesce", ["get", "fillColor"], "#f97316"],
				"circle-stroke-color": ["coalesce", ["get", "strokeColor"], "#ef4444"],
				"circle-stroke-width": ["coalesce", ["get", "strokeWidth"], 2],
			},
		});
		map.addLayer({
			id: "editor-point-hit",
			type: "circle",
			source: "editor-features",
			filter: ["==", ["geometry-type"], "Point"],
			paint: {
				"circle-radius": 18,
				"circle-color": "#000",
				"circle-opacity": 0,
			},
		});
		map.addLayer({
			id: "editor-labels",
			type: "symbol",
			source: "editor-features",
			layout: {
				"text-field": ["get", "label"],
				"text-size": 13,
				"text-offset": [0, 1.6],
				"text-anchor": "top",
				"text-allow-overlap": true,
			},
			paint: {
				"text-color": "#ffffff",
				"text-halo-color": "rgba(0,0,0,0.8)",
				"text-halo-width": 3,
				"text-halo-blur": 0.2,
			},
		});
		map.addLayer({
			id: "editor-draft-fill",
			type: "fill",
			source: "editor-draft",
			paint: {
				"fill-color": "#93c5fd",
				"fill-opacity": 0.25,
			},
		});
		map.addLayer({
			id: "editor-draft-line",
			type: "line",
			source: "editor-draft",
			paint: {
				"line-color": "#3b82f6",
				"line-width": 2,
				"line-dasharray": [2, 2],
			},
		});
		map.doubleClickZoom.disable();
		setMapReady(true);
		map.setLayoutProperty("basemap-osm", "visibility", basemap === "osm" ? "visible" : "none");
		map.setLayoutProperty("basemap-satellite", "visibility", basemap === "satellite" ? "visible" : "none");
	};

	useEffect(() => {
		const container = mapContainerRef.current;
		if (!container) {
			return;
		}
		const existing = mapRef.current;
		if (existing && existing.getContainer() !== container) {
			setMapReady(false);
			existing.remove();
			mapRef.current = null;
		}
		if (mapRef.current) {
			mapRef.current.resize();
			return;
		}
		const map = new maplibregl.Map({
			container,
			style: baseStyle,
			center: [15, 45],
			zoom: 13,
			bearing: 0,
			pitch: 0,
			dragRotate: false,
			pitchWithRotate: false,
			attributionControl: false,
			preserveDrawingBuffer: true,
		} as maplibregl.MapOptions & { preserveDrawingBuffer: boolean });
		mapRef.current = map;
		map.dragRotate.disable();
		map.touchZoomRotate.disableRotation();
		map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
		map.on("load", mapLayersReady);
		return () => {
			setMapReady(false);
			map.remove();
			if (mapRef.current === map) {
				mapRef.current = null;
			}
		};
	}, [isSettingPlayArea, playAreaConfirmed, visible]);

	useEffect(() => {
		if (!mapReady || !playArea) {
			return;
		}
		const map = mapRef.current;
		if (!map) {
			return;
		}
		map.fitBounds(
			[
				[playArea.minLng, playArea.minLat],
				[playArea.maxLng, playArea.maxLat],
			],
			{ padding: 40, animate: false },
		);
		drawGrid();
	}, [mapReady, playArea]);

	useEffect(() => {
		if (!mapReady) {
			return;
		}
		const map = mapRef.current;
		if (!map) {
			return;
		}
		const onClick = (event: MapMouseEvent) => {
			handleClick(event);
		};
		const onMove = (event: MapMouseEvent) => {
			handleMouseMove(event);
		};
		const onDoubleClick = (event: MapMouseEvent) => {
			handleDoubleClick(event);
		};
		const onDown = (event: MapMouseEvent) => {
			handleMouseDown(event);
		};
		const onUp = () => {
			handleMouseUp();
		};
		map.on("click", onClick);
		map.on("mousemove", onMove);
		map.on("dblclick", onDoubleClick);
		map.on("mousedown", onDown);
		map.on("mouseup", onUp);
		return () => {
			map.off("click", onClick);
			map.off("mousemove", onMove);
			map.off("dblclick", onDoubleClick);
			map.off("mousedown", onDown);
			map.off("mouseup", onUp);
		};
	}, [mapReady, mode, draft, hoverPoint, isFreehandDrawing, appliedStyle, isSettingPlayArea]);

	useEffect(() => {
		if (!mapReady) {
			return;
		}
		const map = mapRef.current;
		if (!map) {
			return;
		}
		map.setLayoutProperty("basemap-osm", "visibility", basemap === "osm" ? "visible" : "none");
		map.setLayoutProperty("basemap-satellite", "visibility", basemap === "satellite" ? "visible" : "none");
	}, [mapReady, basemap]);

	useEffect(() => {
		if (!mapReady) {
			return;
		}
		const map = mapRef.current;
		if (!map) {
			return;
		}
		const markers = markersRef.current;
		const nextIds = new Set<string>();
		const zoomScale = getMarkerScale(map.getZoom());
		for (const feature of features) {
			if (feature.kind !== "point" || feature.geometry.type !== "Point") {
				continue;
			}
			nextIds.add(feature.id);
			const existing = markers.get(feature.id);
			const iconName = feature.iconName ?? "map-pin";
			const iconBg = feature.iconBackground ?? true;
			const size = feature.iconSize ?? 22;
			const scale = zoomScale;
			if (existing) {
				existing.marker.setLngLat(feature.geometry.coordinates);
				existing.root.render(
					<PointMarker
						name={iconName}
						color={feature.style.strokeColor}
						fill={feature.style.fillColor}
						background={iconBg}
						scale={scale}
						size={size}
					/>,
				);
				existing.size = size;
				continue;
			}
			const el = document.createElement("div");
			el.className = "pointer-events-none";
			el.style.willChange = "transform";
			el.style.transition = "none";
			const root = createRoot(el);
			root.render(
				<PointMarker
					name={iconName}
					color={feature.style.strokeColor}
					fill={feature.style.fillColor}
					background={iconBg}
					scale={scale}
					size={size}
				/>,
			);
			const marker = new maplibregl.Marker({ element: el, draggable: false })
				.setLngLat(feature.geometry.coordinates)
				.addTo(map);
			markers.set(feature.id, { marker, root, size });
		}
		for (const [id, entry] of markers.entries()) {
			if (!nextIds.has(id)) {
				entry.marker.remove();
				entry.root.unmount();
				markers.delete(id);
			}
		}
	}, [features, mapReady]);

	useEffect(() => {
		if (!mapReady) {
			return;
		}
		const map = mapRef.current;
		const markers = markersRef.current;
		const onZoom = () => {
			const current = mapRef.current;
			if (!current) {
				return;
			}
			const scale = getMarkerScale(current.getZoom());
			for (const entry of markers.values()) {
				const el = entry.marker.getElement();
				el.style.transform = `translate(-50%, -50%) scale(${scale * (entry.size / 22)})`;
			}
		};
		map?.on("zoom", onZoom);
		return () => {
			map?.off("zoom", onZoom);
			for (const entry of markers.values()) {
				entry.marker.remove();
				entry.root.unmount();
			}
			markers.clear();
		};
	}, [mapReady]);

	useEffect(() => {
		if (!mapReady) {
			return;
		}
		const map = mapRef.current;
		if (!map) {
			return;
		}
		const source = map.getSource("editor-features") as GeoJSONSource | undefined;
		if (!source) {
			return;
		}
		source.setData(featuresToCollection(features));
	}, [features, mapReady]);

	useEffect(() => {
		if (!mapReady) {
			return;
		}
		const map = mapRef.current;
		if (!map) {
			return;
		}
		const source = map.getSource("editor-draft") as GeoJSONSource | undefined;
		if (!source) {
			return;
		}
		source.setData(draftToCollection(draft, hoverPoint));
	}, [draft, hoverPoint, mapReady]);

	useEffect(() => {
		const updateOverlay = () => {
			const container = mapContainerRef.current;
			if (!container) {
				return;
			}
			const rect = container.getBoundingClientRect();
			setOverlaySize(Math.min(rect.width, rect.height) * 0.6);
		};
		updateOverlay();
		window.addEventListener("resize", updateOverlay);
		return () => {
			window.removeEventListener("resize", updateOverlay);
		};
	}, []);

	useEffect(() => {
		if (!isSettingPlayArea) {
			return;
		}
		const container = mapContainerRef.current;
		if (!container) {
			return;
		}
		const rect = container.getBoundingClientRect();
		setOverlaySize(Math.min(rect.width, rect.height) * 0.6);
	}, [isSettingPlayArea, mapReady, visible, playAreaConfirmed]);

	const drawGrid = () => {
		const map = mapRef.current;
		const canvas = gridCanvasRef.current;
		if (!map || !canvas || !gridVisible) {
			if (canvas) {
				const context = canvas.getContext("2d");
				if (context) {
					context.clearRect(0, 0, canvas.width, canvas.height);
				}
			}
			return;
		}
		if (!playArea) {
			const context = canvas.getContext("2d");
			if (context) {
				context.clearRect(0, 0, canvas.width, canvas.height);
			}
			return;
		}
		const rect = map.getContainer().getBoundingClientRect();
		if (canvas.width !== rect.width || canvas.height !== rect.height) {
			canvas.width = rect.width;
			canvas.height = rect.height;
		}
		const context = canvas.getContext("2d");
		if (!context) {
			return;
		}
		context.clearRect(0, 0, canvas.width, canvas.height);
		if (!playAreaConfirmed) {
			return;
		}
		const topLeft = map.project([playArea.minLng, playArea.maxLat]);
		const bottomRight = map.project([playArea.maxLng, playArea.minLat]);
		const width = bottomRight.x - topLeft.x;
		const height = bottomRight.y - topLeft.y;
		const sizePx = Math.min(width, height);
		const offsetX = (width - sizePx) / 2;
		const offsetY = (height - sizePx) / 2;
		const left = topLeft.x + offsetX;
		const top = topLeft.y + offsetY;
		const right = left + sizePx;
		const bottom = top + sizePx;
		const cellPx = sizePx / 10;
		const subPx = cellPx / 3;
		const showSubLabels = cellPx >= 162;
		const primaryAlpha = Math.max(0, Math.min(1, 0.5 * gridOpacity));
		const borderAlpha = Math.max(0, Math.min(1, 0.8 * gridOpacity));
		const subAlpha = Math.max(0, Math.min(1, 0.2 * gridOpacity));
		const labelBgAlpha = labelOpacity >= 0.5 ? Math.max(0, Math.min(1, labelOpacity)) : 0;
		const labelTextAlpha = Math.max(0, Math.min(1, labelOpacity));
		const labelStrokeAlpha = Math.max(0, Math.min(1, 0.9 * labelOpacity));
		context.save();
		context.beginPath();
		context.rect(left, top, sizePx, sizePx);
		context.clip();
		context.strokeStyle = `rgba(0,0,0,${primaryAlpha})`;
		context.lineWidth = 1;
		for (let i = 0; i <= 10; i += 1) {
			const x = left + cellPx * i;
			context.beginPath();
			context.moveTo(x, top);
			context.lineTo(x, bottom);
			context.stroke();
		}
		for (let i = 0; i <= 10; i += 1) {
			const y = top + cellPx * i;
			context.beginPath();
			context.moveTo(left, y);
			context.lineTo(right, y);
			context.stroke();
		}
		context.strokeStyle = `rgba(0,0,0,${borderAlpha})`;
		context.lineWidth = 2;
		context.strokeRect(left, top, sizePx, sizePx);
		context.strokeStyle = `rgba(0,0,0,${subAlpha})`;
		for (let i = 0; i <= 30; i += 1) {
			const x = left + subPx * i;
			context.beginPath();
			context.moveTo(x, top);
			context.lineTo(x, bottom);
			context.stroke();
		}
		for (let i = 0; i <= 30; i += 1) {
			const y = top + subPx * i;
			context.beginPath();
			context.moveTo(left, y);
			context.lineTo(right, y);
			context.stroke();
		}
		const drawLabel = (px: number, py: number, label: string, size: number) => {
			const padding = 3;
			context.save();
			context.font = `${size}px Inter, system-ui, sans-serif`;
			context.textAlign = "center";
			context.textBaseline = "middle";
			const metrics = context.measureText(label);
			const textWidth = metrics.width;
			const boxWidth = textWidth + padding * 2;
			const boxHeight = size + padding * 2;
			const boxX = px - boxWidth / 2;
			const boxY = py - boxHeight / 2;
			context.fillStyle = `rgba(0,0,0,${labelBgAlpha})`;
			context.fillRect(boxX, boxY, boxWidth, boxHeight);
			context.fillStyle = `rgba(255,255,255,${labelTextAlpha})`;
			context.strokeStyle = `rgba(0,0,0,${labelStrokeAlpha})`;
			context.lineWidth = 1.25;
			context.strokeText(label, px, py);
			context.fillText(label, px, py);
			context.restore();
		};
		if (gridLabelsVisible && !showSubLabels) {
			context.textBaseline = "middle";
			for (let row = 0; row < 10; row += 1) {
				for (let col = 0; col < 10; col += 1) {
					const px = left + cellPx * (col + 0.5);
					const py = top + cellPx * (row + 0.5);
					const label = `${toLetters(row)}${col + 1}`;
					drawLabel(px, py, label, 12);
				}
			}
		}
		if (gridLabelsVisible && showSubLabels) {
			context.textBaseline = "middle";
			for (let row = 0; row < 10; row += 1) {
				for (let col = 0; col < 10; col += 1) {
					for (let sr = 0; sr < 3; sr += 1) {
						for (let sc = 0; sc < 3; sc += 1) {
							const px = left + cellPx * col + subPx * (sc + 0.5);
							const py = top + cellPx * row + subPx * (sr + 0.5);
							const label = `${toLetters(row)}${col + 1}-${sr * 3 + sc + 1}`;
							drawLabel(px, py, label, 10);
						}
					}
				}
			}
		}
		context.restore();
	};

	useEffect(() => {
		if (!mapReady) {
			return;
		}
		drawGrid();
		const map = mapRef.current;
		if (!map) {
			return;
		}
		const onMove = () => {
			drawGrid();
		};
		map.on("move", onMove);
		map.on("zoom", onMove);
		return () => {
			map.off("move", onMove);
			map.off("zoom", onMove);
		};
	}, [gridVisible, gridLabelsVisible, mapReady, features, playArea, gridOpacity, labelOpacity]);

	useEffect(() => {
		if (!mapReady) {
			return;
		}
		drawGrid();
	}, [mapReady, gridOpacity, labelOpacity]);

	const canFinish = useMemo(() => {
		if (!draft) {
			return false;
		}
		if (draft.type === "line") {
			return draft.points.length >= 2;
		}
		if (draft.type === "polygon") {
			return draft.points.length >= 3;
		}
		return false;
	}, [draft]);

	const stats = useMemo(() => {
		const coords: LngLatTuple[] = [];
		if (playArea) {
			const { minLng, maxLng, minLat, maxLat } = playArea;
			coords.push([minLng, minLat]);
			coords.push([minLng, maxLat]);
			coords.push([maxLng, minLat]);
			coords.push([maxLng, maxLat]);
		}
		for (const feature of features) {
			const geometry = featureToGeoJSON(feature).geometry;
			if (geometry.type === "Point") {
				coords.push(geometry.coordinates as LngLatTuple);
			} else if (geometry.type === "LineString") {
				for (const point of geometry.coordinates as LngLatTuple[]) {
					coords.push(point);
				}
			} else if (geometry.type === "Polygon") {
				for (const ring of geometry.coordinates as LngLatTuple[][]) {
					for (const point of ring) {
						coords.push(point);
					}
				}
			}
		}
		const counts = {
			total: features.length,
			points: 0,
			lines: 0,
			areas: 0,
			freehand: 0,
		};
		for (const feature of features) {
			if (feature.kind === "point") {
				counts.points += 1;
			} else if (feature.kind === "line") {
				counts.lines += 1;
			} else if (feature.kind === "freehand") {
				counts.lines += 1;
				counts.freehand += 1;
			} else {
				counts.areas += 1;
			}
		}
		let totalLineLength = 0;
		for (const feature of features) {
			const geometry = featureToGeoJSON(feature).geometry;
			if (geometry.type === "LineString") {
				totalLineLength += lengthOfCoordinates(geometry.coordinates as LngLatTuple[]);
			}
			if (geometry.type === "Polygon" && feature.kind === "freehand") {
				for (const ring of geometry.coordinates as LngLatTuple[][]) {
					totalLineLength += lengthOfCoordinates(ring);
				}
			}
		}
		const emptyStats = {
			hasBounds: false,
			width: 0,
			height: 0,
			diagonal: 0,
			area: 0,
			counts,
			totalLineLength,
			travel: { walkSeconds: 0, driveSeconds: 0 },
		};
		if (coords.length === 0) {
			return emptyStats;
		}
		const first = coords[0];
		if (!first) {
			return emptyStats;
		}
		let minLng = first[0];
		let maxLng = first[0];
		let minLat = first[1];
		let maxLat = first[1];
		for (const [lng, lat] of coords) {
			if (lng < minLng) {
				minLng = lng;
			}
			if (lng > maxLng) {
				maxLng = lng;
			}
			if (lat < minLat) {
				minLat = lat;
			}
			if (lat > maxLat) {
				maxLat = lat;
			}
		}
		const width = distanceMeters([minLng, minLat], [maxLng, minLat]);
		const height = distanceMeters([minLng, minLat], [minLng, maxLat]);
		const diagonal = distanceMeters([minLng, minLat], [maxLng, maxLat]);
		const area = width * height;
		const walkSeconds = diagonal / 1.4;
		const driveSeconds = diagonal / 13.8889;
		return {
			hasBounds: true,
			width,
			height,
			diagonal,
			area,
			counts,
			totalLineLength,
			travel: { walkSeconds, driveSeconds },
		};
	}, [features, playArea]);

	const formatDistance = (meters: number) => {
		if (meters <= 0) {
			return t("testMap.stats.notAvailable");
		}
		if (meters >= 1000) {
			return t("testMap.stats.units.kilometers", { value: (meters / 1000).toFixed(1) });
		}
		return t("testMap.stats.units.meters", { value: Math.round(meters) });
	};

	const formatArea = (squareMeters: number) => {
		if (squareMeters <= 0) {
			return t("testMap.stats.notAvailable");
		}
		if (squareMeters >= 1_000_000) {
			return t("testMap.stats.units.squareKilometers", { value: (squareMeters / 1_000_000).toFixed(2) });
		}
		return t("testMap.stats.units.squareMeters", { value: Math.round(squareMeters) });
	};

	const formatDuration = (seconds: number) => {
		if (seconds <= 0) {
			return t("testMap.stats.notAvailable");
		}
		const minutes = Math.max(1, Math.round(seconds / 60));
		if (minutes < 60) {
			return t("testMap.stats.units.minutes", { value: minutes });
		}
		const hours = Math.floor(minutes / 60);
		const remainder = minutes % 60;
		if (remainder === 0) {
			return t("testMap.stats.units.hours", { value: hours });
		}
		return t("testMap.stats.units.hoursMinutes", { hours, minutes: remainder });
	};

	const selectedFeature = useMemo(() => {
		if (!selectedId) {
			return undefined;
		}
		for (const feature of features) {
			if (feature.id === selectedId) {
				return feature;
			}
		}
		return undefined;
	}, [features, selectedId]);

	useEffect(() => {
		if (selectedFeature) {
			setStrokeColorInput(selectedFeature.style.strokeColor);
			setFillColorInput(selectedFeature.style.fillColor);
			setIconSizeInput(selectedFeature.iconSize ?? 22);
		} else {
			setStrokeColorInput(appliedStyle.strokeColor);
			setFillColorInput(appliedStyle.fillColor);
			setIconSizeInput(22);
		}
	}, [selectedFeature, appliedStyle.strokeColor, appliedStyle.fillColor]);

	useEffect(() => {
		const handleKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
				event.preventDefault();
				if (event.shiftKey) {
					redo();
					return;
				}
				undo();
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
				event.preventDefault();
				duplicateSelected();
				return;
			}
			if ((event.key === "Delete" || event.key === "Backspace") && selectedFeature) {
				event.preventDefault();
				deleteFeature(selectedFeature.id);
				return;
			}
			if (event.key === "Escape") {
				updateDraft(null);
				setHoverPoint(null);
				setSnapPoint(null);
				return;
			}
			if (event.key === "Enter" && canFinish) {
				event.preventDefault();
				finishDraft();
			}
		};
		window.addEventListener("keydown", handleKey);
		return () => {
			window.removeEventListener("keydown", handleKey);
		};
	}, [selectedFeature, duplicateSelected, deleteFeature, undo, redo, canFinish, finishDraft, updateDraft]);

	const scheduleStrokeUpdate = (value: string) => {
		if (strokeRafRef.current) {
			cancelAnimationFrame(strokeRafRef.current);
		}
		strokeRafRef.current = requestAnimationFrame(() => {
			setStyle({ ...appliedStyle, strokeColor: value });
			if (selectedFeature) {
				updateFeature(selectedFeature.id, (feature) => ({
					...feature,
					style: { ...feature.style, strokeColor: value },
				}));
			}
		});
	};

	const scheduleFillUpdate = (value: string) => {
		if (fillRafRef.current) {
			cancelAnimationFrame(fillRafRef.current);
		}
		fillRafRef.current = requestAnimationFrame(() => {
			setStyle({ ...appliedStyle, fillColor: value });
			if (selectedFeature) {
				updateFeature(selectedFeature.id, (feature) => ({
					...feature,
					style: { ...feature.style, fillColor: value },
				}));
			}
		});
	};

	const setIconSize = (value: number) => {
		setIconSizeInput(value);
		if (selectedFeature) {
			updateFeature(selectedFeature.id, (feature) => ({
				...feature,
				iconSize: value,
			}));
		}
	};

	const onStrokeWidthChange = (value: number[]) => {
		const width = value[0] ?? appliedStyle.strokeWidth;
		const nextStyle: FeatureStyle = { ...appliedStyle, strokeWidth: width };
		setStyle(nextStyle);
		if (selectedFeature) {
			updateFeature(selectedFeature.id, (feature) => ({
				...feature,
				style: { ...feature.style, strokeWidth: width },
			}));
		}
	};

	const onFillOpacityChange = (value: number[]) => {
		const opacity = (value[0] ?? appliedStyle.fillOpacity * 100) / 100;
		const nextStyle: FeatureStyle = { ...appliedStyle, fillOpacity: opacity };
		setStyle(nextStyle);
		if (selectedFeature) {
			updateFeature(selectedFeature.id, (feature) => ({
				...feature,
				style: { ...feature.style, fillOpacity: opacity },
			}));
		}
	};

	const onLabelChange = (value: string) => {
		if (!selectedFeature) {
			return;
		}
		updateFeature(selectedFeature.id, (feature) => ({ ...feature, label: value }));
	};

	const exportPlayAreaPng = async () => {
		const map = mapRef.current;
		const container = mapContainerRef.current;
		if (!map || !container || !playArea || !playAreaConfirmed) {
			return;
		}
		await new Promise<void>((resolve) => {
			if (map.isMoving()) {
				map.once("idle", () => resolve());
				return;
			}
			resolve();
		});
		const mapCanvas = map.getCanvas();
		const dpr = window.devicePixelRatio || 1;
		const rect = container.getBoundingClientRect();
		const size = overlaySize || Math.min(rect.width, rect.height) * 0.6;
		const half = size / 2;
		const cx = rect.width / 2;
		const cy = rect.height / 2;
		const sx = Math.max(0, (cx - half) * dpr);
		const sy = Math.max(0, (cy - half) * dpr);
		const sw = Math.min(size * dpr, mapCanvas.width - sx);
		const sh = Math.min(size * dpr, mapCanvas.height - sy);
		const exportCanvas = document.createElement("canvas");
		exportCanvas.width = Math.round(size);
		exportCanvas.height = Math.round(size);
		const ctx = exportCanvas.getContext("2d");
		if (!ctx) {
			return;
		}
		ctx.drawImage(mapCanvas, sx, sy, sw, sh, 0, 0, exportCanvas.width, exportCanvas.height);
		const blob = await new Promise<Blob | null>((resolve) => {
			exportCanvas.toBlob((result) => resolve(result), "image/png");
		});
		if (!blob) {
			return;
		}
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "map-editor.png";
		link.click();
		URL.revokeObjectURL(url);
	};

	const handleExport = () => {
		const collection = featuresToCollection(features);
		if (playArea && playAreaConfirmed) {
			collection.bbox = [playArea.minLng, playArea.minLat, playArea.maxLng, playArea.maxLat] satisfies BBox;
		}
		const blob = new Blob([JSON.stringify(collection, null, 2)], { type: "application/geo+json" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "map-editor.geojson";
		link.click();
		URL.revokeObjectURL(url);
	};

	const handleResetView = () => {
		const map = mapRef.current;
		if (!map) {
			return;
		}
		if (playArea) {
			map.fitBounds(
				[
					[playArea.minLng, playArea.minLat],
					[playArea.maxLng, playArea.maxLat],
				],
				{ padding: 40, animate: true },
			);
			return;
		}
		map.easeTo({ center: [15, 45], zoom: 13 });
	};

	const handleNewMap = () => {
		clear();
		setPlayArea(null);
		setPlayAreaConfirmed(false);
		setIsSettingPlayArea(true);
		updateDraft(null);
		setHoverPoint(null);
		setSnapPoint(null);
	};

	const handleImport = async (file: File) => {
		const text = await file.text();
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			return;
		}
		if (!parsed || typeof parsed !== "object") {
			return;
		}
		const collection = parsed as FeatureCollection;
		if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
			return;
		}
		const bbox = collection.bbox;
		if (Array.isArray(bbox) && bbox.length === 4) {
			const [minLng, minLat, maxLng, maxLat] = bbox;
			const valid =
				typeof minLng === "number" &&
				typeof minLat === "number" &&
				typeof maxLng === "number" &&
				typeof maxLat === "number";
			if (valid) {
				setPlayArea({ minLng, minLat, maxLng, maxLat });
				setPlayAreaConfirmed(true);
				setIsSettingPlayArea(false);
			}
		}
		const imported = collectionToFeatures(collection, {
			style: appliedStyle,
			iconName: pointIconRef.current ?? "map-pin",
			iconBackground: true,
			iconSize: 22,
		});
		if (imported.length === 0) {
			return;
		}
		replaceFeatures(imported);
	};

	const onImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}
		await handleImport(file);
		event.target.value = "";
	};

	const handleClear = () => {
		clear();
		updateDraft(null);
		setHoverPoint(null);
	};

	const hasSelection = Boolean(selectedFeature);
	const canUndo = history.length > 0;
	const canRedo = future.length > 0;
	const modeLabel = useMemo(() => {
		for (const button of modeButtons) {
			if (button.mode === mode) {
				return button.label;
			}
		}
		return mode;
	}, [modeButtons, mode]);
	const [iconSearch, setIconSearch] = useState("");
	const filteredIcons = useMemo(() => {
		const query = iconSearch.trim().toLowerCase();
		if (!query) {
			return iconNames;
		}
		const results: string[] = [];
		for (const name of iconNames) {
			if (name.includes(query)) {
				results.push(name);
			}
		}
		return results.slice(0, 120);
	}, [iconSearch]);

	const findSnapPoint = (lngLat: LngLat): LngLatTuple | null => {
		const map = mapRef.current;
		if (!map) {
			return null;
		}
		const threshold = 10;
		const cursorPoint = map.project(lngLat);
		const vertices: LngLatTuple[] = [...allVertices];
		if (draft && (draft.type === "line" || draft.type === "polygon")) {
			vertices.push(...draft.points);
		}
		let best: { coord: LngLatTuple; dist: number } | null = null;
		for (const coord of vertices) {
			const point = map.project({ lng: coord[0], lat: coord[1] });
			const dx = point.x - cursorPoint.x;
			const dy = point.y - cursorPoint.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist <= threshold && (!best || dist < best.dist)) {
				best = { coord, dist };
			}
		}
		return best ? best.coord : null;
	};

	const getMarkerScale = (zoom: number) => {
		const base = 1 + (zoom - 10) * 0.08;
		const clamped = Math.min(Math.max(base, 0.4), 3);
		return clamped;
	};

	const formatCoordShort = (value: number, isLat: boolean) => {
		const abs = Math.abs(value);
		const suffix = isLat ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
		const decimals = abs >= 1 ? 3 : 5;
		return `${abs.toFixed(decimals)}${suffix}`;
	};

	const toLetters = (index: number) => {
		let n = index;
		let result = "";
		while (n >= 0) {
			const charCode = (n % 26) + 65;
			result = `${String.fromCharCode(charCode)}${result}`;
			n = Math.floor(n / 26) - 1;
		}
		return result;
	};

	useEffect(() => {
		setSnapPoint(null);
		setHoverPoint(null);
	}, [mode]);

	const allVertices = useMemo<LngLatTuple[]>(() => {
		const verts: LngLatTuple[] = [];
		for (const feature of features) {
			const { geometry } = feature;
			if (geometry.type === "Point") {
				verts.push(geometry.coordinates);
			} else if (geometry.type === "LineString") {
				verts.push(...geometry.coordinates);
			} else if (geometry.type === "Polygon") {
				for (const ring of geometry.coordinates) {
					verts.push(...ring);
				}
			} else if (geometry.type === "Rectangle") {
				verts.push(geometry.start, geometry.end);
			} else if (geometry.type === "Circle") {
				verts.push(geometry.center);
				if (geometry.edge) {
					verts.push(geometry.edge);
				}
			} else if (geometry.type === "Freehand") {
				verts.push(...geometry.coordinates);
			}
		}
		return verts;
	}, [features]);

	const containerClass = visible
		? "fixed inset-0 z-50 flex h-screen w-screen flex-col bg-background p-4"
		: "flex h-[calc(100vh-64px)] w-full flex-col gap-4 p-4";

	const handleModeChange = (nextMode: EditorMode) => {
		setMode(nextMode);
		updateDraft(null);
		setHoverPoint(null);
	};

	const setPlayAreaFromOverlay = () => {
		const map = mapRef.current;
		const container = mapContainerRef.current;
		if (!map || !container) {
			return;
		}
		const rect = container.getBoundingClientRect();
		const size = overlaySize || Math.min(rect.width, rect.height) * 0.6;
		const half = size / 2;
		const cx = rect.width / 2;
		const cy = rect.height / 2;
		const nw = map.unproject([cx - half, cy - half]);
		const se = map.unproject([cx + half, cy + half]);
		setPlayArea({
			minLng: Math.min(nw.lng, se.lng),
			maxLng: Math.max(nw.lng, se.lng),
			minLat: Math.min(se.lat, nw.lat),
			maxLat: Math.max(se.lat, nw.lat),
		});
		setPlayAreaConfirmed(true);
		setIsSettingPlayArea(false);
		drawGrid();
	};

	const cancelPlayAreaEdit = () => {
		const previous = previousPlayAreaRef.current;
		if (previous) {
			setPlayArea(previous);
			setPlayAreaConfirmed(true);
			setIsSettingPlayArea(false);
			drawGrid();
			return;
		}
		setPlayArea(null);
		setPlayAreaConfirmed(false);
		setIsSettingPlayArea(false);
		updateDraft(null);
	};

	const handlePlayAreaToggle = () => {
		const map = mapRef.current;
		const container = mapContainerRef.current;
		if (!map || !container) {
			return;
		}
		if (!playAreaConfirmed) {
			setPlayAreaFromOverlay();
			return;
		}
		previousPlayAreaRef.current = playArea;
		setPlayAreaConfirmed(false);
		setIsSettingPlayArea(true);
		setPlayArea(null);
		updateDraft(null);
	};

	const handleImportClick = () => {
		if (importRef.current) {
			importRef.current.click();
		}
	};

	const handleClearSelection = () => {
		setSelectedId(undefined);
	};

	const handleDeleteSelection = () => {
		if (!selectedId) {
			return;
		}
		deleteFeature(selectedId);
	};

	const handleDuplicateSelection = () => {
		if (!selectedId) {
			return;
		}
		handleDuplicateFeature(selectedId);
	};

	const handleDuplicateFeature = (id: string) => {
		setSelectedId(id);
		duplicateSelected();
	};

	const handleConfirmNewMap = async () => {
		const result = await confirm({
			title: t("testMap.dialogs.newMap.title"),
			body: (
				<div className="flex flex-col gap-2 text-sm">
					<p>{t("testMap.dialogs.newMap.body")}</p>
					<Button
						type="button"
						variant="outline"
						onClick={(event) => {
							event.preventDefault();
							handleExport();
						}}
					>
						<FileDown className="mr-2 size-4" />
						{t("testMap.dialogs.newMap.download")}
					</Button>
				</div>
			),
			actionButton: t("testMap.dialogs.newMap.confirm"),
			cancelButtonVariant: "outline",
			cancelButton: t("testMap.dialogs.newMap.cancel"),
		});
		if (!result) {
			return;
		}
		handleNewMap();
	};

	const handleIconBackgroundChange = (checked: boolean) => {
		if (!selectedFeature) {
			return;
		}
		updateFeature(selectedFeature.id, (feature) => ({
			...feature,
			iconBackground: checked,
		}));
	};

	const handleIconSelect = (name: string) => {
		pointIconRef.current = name;
		setIconSearch("");
		if (!selectedFeature) {
			return;
		}
		updateFeature(selectedFeature.id, (feature) => ({
			...feature,
			iconName: name,
		}));
	};

	const handleIconSizeChange = (value: number[]) => {
		setIconSize(value[0] ?? 22);
	};

	const handleBasemapChange = (value: BasemapId) => {
		setBasemap(value);
	};

	return (
		<div className={containerClass}>
			<Dialog open={statsOpen} onOpenChange={setStatsOpen}>
				<DialogContent className="sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>{t("testMap.stats.title")}</DialogTitle>
						<DialogDescription>{t("testMap.stats.description")}</DialogDescription>
					</DialogHeader>
					{stats.hasBounds ? (
						<div className="grid gap-3">
							<div className="rounded-md border p-3">
								<div className="text-sm font-semibold">{t("testMap.stats.sections.size.title")}</div>
								<div className="mt-2 space-y-1 text-sm">
									<div className="flex items-center justify-between">
										<span>{t("testMap.stats.sections.size.width")}</span>
										<span className="font-mono">{formatDistance(stats.width)}</span>
									</div>
									<div className="flex items-center justify-between">
										<span>{t("testMap.stats.sections.size.height")}</span>
										<span className="font-mono">{formatDistance(stats.height)}</span>
									</div>
									<div className="flex items-center justify-between">
										<span>{t("testMap.stats.sections.size.diagonal")}</span>
										<span className="font-mono">{formatDistance(stats.diagonal)}</span>
									</div>
									<div className="flex items-center justify-between">
										<span>{t("testMap.stats.sections.size.area")}</span>
										<span className="font-mono">{formatArea(stats.area)}</span>
									</div>
								</div>
							</div>
							<div className="rounded-md border p-3">
								<div className="text-sm font-semibold">
									{t("testMap.stats.sections.features.title")}
								</div>
								<div className="mt-2 space-y-1 text-sm">
									<div className="flex items-center justify-between">
										<span>{t("testMap.stats.sections.features.total")}</span>
										<span className="font-mono">{stats.counts.total}</span>
									</div>
									<div className="flex items-center justify-between">
										<span>{t("testMap.stats.sections.features.points")}</span>
										<span className="font-mono">{stats.counts.points}</span>
									</div>
									<div className="flex items-center justify-between">
										<span>{t("testMap.stats.sections.features.lines")}</span>
										<span className="font-mono">{stats.counts.lines}</span>
									</div>
									<div className="flex items-center justify-between">
										<span>{t("testMap.stats.sections.features.areas")}</span>
										<span className="font-mono">{stats.counts.areas}</span>
									</div>
									<div className="flex items-center justify-between">
										<span>{t("testMap.stats.sections.features.freehand")}</span>
										<span className="font-mono">{stats.counts.freehand}</span>
									</div>
								</div>
							</div>
							<div className="rounded-md border p-3">
								<div className="text-sm font-semibold">
									{t("testMap.stats.sections.distance.title")}
								</div>
								<div className="mt-2 space-y-1 text-sm">
									<div className="flex items-center justify-between">
										<span>{t("testMap.stats.sections.distance.lineLength")}</span>
										<span className="font-mono">{formatDistance(stats.totalLineLength)}</span>
									</div>
									<div className="flex items-center justify-between">
										<span>{t("testMap.stats.sections.distance.crossingWalk")}</span>
										<span className="font-mono">{formatDuration(stats.travel.walkSeconds)}</span>
									</div>
									<div className="flex items-center justify-between">
										<span>{t("testMap.stats.sections.distance.crossingDrive")}</span>
										<span className="font-mono">{formatDuration(stats.travel.driveSeconds)}</span>
									</div>
								</div>
							</div>
						</div>
					) : (
						<p className="text-sm text-muted-foreground">{t("testMap.stats.empty")}</p>
					)}
				</DialogContent>
			</Dialog>
			<EditorTopbar
				t={t}
				basemap={basemap}
				basemapOptions={basemapOptions}
				onBasemapChange={handleBasemapChange}
				gridVisible={gridVisible}
				onGridToggle={(value) => {
					setGridVisible(value);
					drawGrid();
				}}
				gridLabelsVisible={gridLabelsVisible}
				onGridLabelsToggle={(value) => {
					setGridLabelsVisible(value);
					drawGrid();
				}}
				gridOpacity={gridOpacity}
				labelOpacity={labelOpacity}
				onGridOpacityChange={(value) => {
					setGridOpacity(value);
					drawGrid();
				}}
				onLabelOpacityChange={(value) => {
					setLabelOpacity(value);
					drawGrid();
				}}
				playAreaConfirmed={playAreaConfirmed}
				isSettingPlayArea={isSettingPlayArea}
				onTogglePlayArea={handlePlayAreaToggle}
				onUndo={undo}
				onRedo={redo}
				onExport={handleExport}
				onExportPng={exportPlayAreaPng}
				onNewMap={handleConfirmNewMap}
				onResetView={handleResetView}
				onImportClick={handleImportClick}
				onClearSelection={handleClearSelection}
				onDeleteSelection={handleDeleteSelection}
				onDuplicateSelection={handleDuplicateSelection}
				canUndo={canUndo}
				canRedo={canRedo}
				helpOpen={helpOpen}
				onHelpOpenChange={setHelpOpen}
				onOpenStats={() => setStatsOpen(true)}
				keybinds={keybinds}
				visible={visible}
				onClose={onClose}
				dimmed={false}
				modeLabel={modeLabel}
			/>
			<input
				ref={importRef}
				type="file"
				className="hidden"
				accept=".geojson,application/geo+json,application/json"
				onChange={onImportChange}
			/>
			{hasPlayArea && playAreaConfirmed ? (
				<div className="flex flex-1 min-h-0 gap-4 overflow-hidden">
					<EditorControlsPanel
						t={t}
						modeButtons={modeButtons}
						mode={mode}
						onModeChange={handleModeChange}
						onFinishDraft={finishDraft}
						canFinish={canFinish}
						onClear={handleClear}
						features={features}
						selectedId={selectedId}
						onSelectFeature={setSelectedId}
						onDuplicateFeature={handleDuplicateFeature}
						onDeleteFeature={deleteFeature}
						sidebarIconSize={sidebarIconSize}
						dimmed={false}
					/>
					<Card className="flex flex-1 min-h-0 flex-col">
						<CardContent className="flex-1 p-0">
							<div className="relative h-full w-full overflow-hidden rounded-lg border">
								<div ref={mapContainerRef} className="h-full w-full" />
								<canvas ref={gridCanvasRef} className="pointer-events-none absolute inset-0" />
								{!mapReady ? (
									<div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
										<Loader className="h-8 w-8 animate-spin text-muted-foreground" />
									</div>
								) : null}
								{gridRef.cell ? (
									<div className="absolute right-4 top-4 rounded-md bg-background/90 backdrop-blur px-3 py-2 text-xs shadow space-y-1">
										<div className="font-semibold">{t("testMap.gridRef.title")}</div>
										<div className="flex items-center justify-between gap-3">
											<span className="text-muted-foreground">{t("testMap.gridRef.cell")}</span>
											<span className="font-mono text-sm">{gridRef.cell}</span>
										</div>
										<div className="flex items-center justify-between gap-3">
											<span className="text-muted-foreground">{t("testMap.gridRef.lat")}</span>
											<span className="font-mono text-sm">{gridRef.lat}</span>
										</div>
										<div className="flex items-center justify-between gap-3">
											<span className="text-muted-foreground">{t("testMap.gridRef.lng")}</span>
											<span className="font-mono text-sm">{gridRef.lng}</span>
										</div>
									</div>
								) : null}
								{draft ? (
									<div className="absolute left-4 bottom-4 rounded-md bg-background/90 backdrop-blur px-3 py-2 text-xs shadow">
										{draft.type === "line" ? t("testMap.status.line") : null}
										{draft.type === "polygon" ? t("testMap.status.polygon") : null}
										{draft.type === "rectangle" ? t("testMap.status.rectangle") : null}
										{draft.type === "circle" ? t("testMap.status.circle") : null}
										{draft.type === "freehand" ? t("testMap.status.freehand") : null}
									</div>
								) : null}
							</div>
						</CardContent>
					</Card>
					<EditorSelectionPanel
						t={t}
						selectedFeature={selectedFeature}
						hasSelection={hasSelection}
						strokeColorInput={strokeColorInput}
						fillColorInput={fillColorInput}
						appliedStyle={appliedStyle}
						iconSizeInput={iconSizeInput}
						iconSearch={iconSearch}
						filteredIcons={filteredIcons}
						sidebarIconSize={sidebarIconSize}
						onLabelChange={onLabelChange}
						onStrokeColorChange={(value) => {
							setStrokeColorInput(value);
							scheduleStrokeUpdate(value);
						}}
						onFillColorChange={(value) => {
							setFillColorInput(value);
							scheduleFillUpdate(value);
						}}
						onStrokeWidthChange={onStrokeWidthChange}
						onFillOpacityChange={onFillOpacityChange}
						onIconBackgroundChange={handleIconBackgroundChange}
						onIconSizeChange={handleIconSizeChange}
						onIconSearchChange={setIconSearch}
						onIconSelect={handleIconSelect}
						dimmed={false}
					/>
				</div>
			) : (
				<div className="flex flex-1 min-h-0">
					<Card className="flex flex-1 min-h-0 flex-col">
						<CardContent className="flex-1 p-0">
							<div className="relative h-full w-full overflow-hidden rounded-lg border">
								<div ref={mapContainerRef} className="h-full w-full" />
								<canvas ref={gridCanvasRef} className="pointer-events-none absolute inset-0" />
								{!mapReady ? (
									<div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
										<Loader className="h-8 w-8 animate-spin text-muted-foreground" />
									</div>
								) : null}
								{mapReady && overlaySize > 0 ? (
									<div className="pointer-events-none absolute inset-0 z-30">
										<div className="relative h-full w-full">
											<div className="absolute inset-0 flex items-center justify-center">
												<div
													className="pointer-events-none border-2 border-primary/80"
													style={{
														width: `${overlaySize}px`,
														height: `${overlaySize}px`,
														boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
													}}
												/>
											</div>
											<div className="absolute inset-0 z-10 flex items-end justify-center pb-6">
												<div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-md shadow-lg">
													<Button size="sm" onClick={setPlayAreaFromOverlay}>
														{t("testMap.actions.confirmPlayArea")}
													</Button>
													{previousPlayAreaRef.current ? (
														<Button
															variant="outline"
															size="sm"
															onClick={cancelPlayAreaEdit}
														>
															{t("testMap.actions.cancelPlayArea")}
														</Button>
													) : null}
												</div>
											</div>
										</div>
									</div>
								) : null}
							</div>
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
}
