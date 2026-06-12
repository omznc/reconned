"use client";

import { AlertCircle } from "lucide-react";
import maplibregl, { type GeoJSONSource, type LngLatLike, type Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
import { PointMarker } from "@/components/map-editor/_components/point-marker";
import { ViewerControlsPanel } from "@/components/map-editor/_components/viewer-controls-panel";
import { MAP_DEFAULT_STYLE } from "@/components/map-editor/constants";
import { createEmptySnapshot, playAreaFromBbox } from "@/components/map-editor/map-data";
import type { BasemapId, MapEditorSnapshot, MapPlayArea } from "@/components/map-editor/types";
import { cn } from "@/lib/utils";
import { checkWebGLSupport, getWebGLErrorMessage } from "@/lib/webgl-support";

type MapViewerProps = {
	data?: MapEditorSnapshot | null;
	className?: string;
	height?: number | string;
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

const collectionBounds = (collection: FeatureCollection): maplibregl.LngLatBoundsLike | null => {
	let minLng: number | null = null;
	let maxLng: number | null = null;
	let minLat: number | null = null;
	let maxLat: number | null = null;
	for (let index = 0; index < collection.features.length; index += 1) {
		const feature = collection.features[index];
		if (!feature?.geometry) {
			continue;
		}
		const geometry = feature.geometry;
		if (geometry.type === "Point") {
			const coords = geometry.coordinates;
			const lng = coords[0];
			const lat = coords[1];
			if (typeof lng !== "number" || typeof lat !== "number") {
				continue;
			}
			minLng = minLng === null ? lng : Math.min(minLng, lng);
			maxLng = maxLng === null ? lng : Math.max(maxLng, lng);
			minLat = minLat === null ? lat : Math.min(minLat, lat);
			maxLat = maxLat === null ? lat : Math.max(maxLat, lat);
		} else if (geometry.type === "LineString") {
			for (let point = 0; point < geometry.coordinates.length; point += 1) {
				const coord = geometry.coordinates[point];
				if (!coord) {
					continue;
				}
				const lng = coord[0];
				const lat = coord[1];
				if (typeof lng !== "number" || typeof lat !== "number") {
					continue;
				}
				minLng = minLng === null ? lng : Math.min(minLng, lng);
				maxLng = maxLng === null ? lng : Math.max(maxLng, lng);
				minLat = minLat === null ? lat : Math.min(minLat, lat);
				maxLat = maxLat === null ? lat : Math.max(maxLat, lat);
			}
		} else if (geometry.type === "Polygon") {
			for (let ringIndex = 0; ringIndex < geometry.coordinates.length; ringIndex += 1) {
				const ring = geometry.coordinates[ringIndex];
				if (!ring) {
					continue;
				}
				for (let coordIndex = 0; coordIndex < ring.length; coordIndex += 1) {
					const coord = ring[coordIndex];
					if (!coord) {
						continue;
					}
					const lng = coord[0];
					const lat = coord[1];
					if (typeof lng !== "number" || typeof lat !== "number") {
						continue;
					}
					minLng = minLng === null ? lng : Math.min(minLng, lng);
					maxLng = maxLng === null ? lng : Math.max(maxLng, lng);
					minLat = minLat === null ? lat : Math.min(minLat, lat);
					maxLat = maxLat === null ? lat : Math.max(maxLat, lat);
				}
			}
		}
	}
	if (minLng === null || maxLng === null || minLat === null || maxLat === null) {
		return null;
	}
	return [
		[minLng, minLat],
		[maxLng, maxLat],
	];
};

const getMarkerScale = (zoom: number) => {
	const base = 1 + (zoom - 10) * 0.08;
	const clamped = Math.min(Math.max(base, 0.4), 3);
	return clamped;
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

const drawGrid = (
	map: MapLibreMap,
	canvas: HTMLCanvasElement,
	playArea: MapPlayArea | null,
	grid: MapEditorSnapshot["grid"],
) => {
	if (!grid.visible) {
		const context = canvas.getContext("2d");
		if (context) {
			context.clearRect(0, 0, canvas.width, canvas.height);
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
	const subSubPx = subPx / 3;
	const subLinesThresholdPx = 90;
	const subLabelsThresholdPx = 150;
	const subSubLinesThresholdPx = 240;
	const subSubLabelsThresholdPx = 320;
	const showSubLines = cellPx >= subLinesThresholdPx;
	const showSubLabels = cellPx >= subLabelsThresholdPx;
	const showSubSubLines = cellPx >= subSubLinesThresholdPx;
	const showSubSubLabels = cellPx >= subSubLabelsThresholdPx;
	const primaryAlpha = Math.max(0, Math.min(1, 0.5 * grid.opacity));
	const borderAlpha = Math.max(0, Math.min(1, 0.8 * grid.opacity));
	const subAlpha = Math.max(0, Math.min(1, 0.2 * grid.opacity));
	const subSubAlpha = Math.max(0, Math.min(1, 0.14 * grid.opacity));
	const labelBgAlpha = grid.labelOpacity >= 0.5 ? Math.max(0, Math.min(1, grid.labelOpacity)) : 0;
	const labelTextAlpha = Math.max(0, Math.min(1, grid.labelOpacity));
	const labelStrokeAlpha = Math.max(0, Math.min(1, 0.9 * grid.labelOpacity));
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
	if (showSubLines) {
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
	}
	if (showSubSubLines) {
		context.strokeStyle = `rgba(0,0,0,${subSubAlpha})`;
		for (let i = 0; i <= 90; i += 1) {
			const x = left + subSubPx * i;
			context.beginPath();
			context.moveTo(x, top);
			context.lineTo(x, bottom);
			context.stroke();
		}
		for (let i = 0; i <= 90; i += 1) {
			const y = top + subSubPx * i;
			context.beginPath();
			context.moveTo(left, y);
			context.lineTo(right, y);
			context.stroke();
		}
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
	if (grid.labelsVisible && !showSubLabels) {
		context.textBaseline = "middle";
		for (let row = 0; row < 10; row += 1) {
			for (let col = 0; col < 10; col += 1) {
				const px = left + cellPx * (col + 0.5);
				const py = top + cellPx * (row + 0.5);
				if (px < 0 || px > canvas.width || py < 0 || py > canvas.height) {
					continue;
				}
				const label = `${toLetters(row)}${col + 1}`;
				drawLabel(px, py, label, 12);
			}
		}
	}
	if (grid.labelsVisible && showSubLabels && !showSubSubLabels) {
		context.textBaseline = "middle";
		for (let row = 0; row < 10; row += 1) {
			for (let col = 0; col < 10; col += 1) {
				for (let sr = 0; sr < 3; sr += 1) {
					for (let sc = 0; sc < 3; sc += 1) {
						const px = left + cellPx * col + subPx * (sc + 0.5);
						const py = top + cellPx * row + subPx * (sr + 0.5);
						if (px < 0 || px > canvas.width || py < 0 || py > canvas.height) {
							continue;
						}
						const label = `${toLetters(row)}${col + 1}-${sr * 3 + sc + 1}`;
						drawLabel(px, py, label, 10);
					}
				}
			}
		}
	}
	if (grid.labelsVisible && showSubSubLabels) {
		context.textBaseline = "middle";
		for (let row = 0; row < 10; row += 1) {
			for (let col = 0; col < 10; col += 1) {
				for (let sr = 0; sr < 3; sr += 1) {
					for (let sc = 0; sc < 3; sc += 1) {
						for (let ssr = 0; ssr < 3; ssr += 1) {
							for (let ssc = 0; ssc < 3; ssc += 1) {
								const px = left + cellPx * col + subPx * sc + subSubPx * (ssc + 0.5);
								const py = top + cellPx * row + subPx * sr + subSubPx * (ssr + 0.5);
								if (px < 0 || px > canvas.width || py < 0 || py > canvas.height) {
									continue;
								}
								const subIndex = sr * 3 + sc + 1;
								const subSubIndex = ssr * 3 + ssc + 1;
								const label = `${toLetters(row)}${col + 1}-${subIndex}-${subSubIndex}`;
								drawLabel(px, py, label, 9);
							}
						}
					}
				}
			}
		}
	}
	context.restore();
};

function MapViewer({ data, className, height = 400 }: MapViewerProps) {
	const snapshot = useMemo(() => data || createEmptySnapshot(), [data]);
	const mapRef = useRef<MapLibreMap | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const markersRef = useRef<Map<string, { marker: maplibregl.Marker; root: Root; size: number }>>(new Map());
	const [mapReady, setMapReady] = useState(false);
	const [webglError, setWebglError] = useState<string | null>(null);
	const playArea = useMemo(() => snapshot.playArea || playAreaFromBbox(snapshot.collection.bbox), [snapshot]);

	// View control states
	const [gridVisible, setGridVisible] = useState(snapshot.grid?.visible ?? true);
	const [gridLabelsVisible, setGridLabelsVisible] = useState(snapshot.grid?.labelsVisible ?? true);
	const [gridOpacity, setGridOpacity] = useState(snapshot.grid?.opacity ?? 0.5);
	const [labelOpacity, setLabelOpacity] = useState(0.45);
	const [basemap, setBasemap] = useState<BasemapId>(snapshot.basemap || "osm");

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
		map.addSource("viewer-features", {
			type: "geojson",
			data: emptyCollection,
		});
		map.addLayer({
			id: "viewer-fill",
			type: "fill",
			source: "viewer-features",
			filter: ["==", ["geometry-type"], "Polygon"],
			paint: {
				"fill-color": ["coalesce", ["get", "fillColor"], MAP_DEFAULT_STYLE.fillColor],
				"fill-opacity": ["coalesce", ["get", "fillOpacity"], MAP_DEFAULT_STYLE.fillOpacity],
			},
		});
		map.addLayer({
			id: "viewer-line",
			type: "line",
			source: "viewer-features",
			filter: ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "LineString"]],
			paint: {
				"line-color": ["coalesce", ["get", "strokeColor"], MAP_DEFAULT_STYLE.strokeColor],
				"line-width": ["coalesce", ["get", "strokeWidth"], MAP_DEFAULT_STYLE.strokeWidth],
			},
		});
		map.addLayer({
			id: "viewer-point",
			type: "circle",
			source: "viewer-features",
			filter: ["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "iconName"], ""]],
			paint: {
				"circle-radius": 6,
				"circle-color": ["coalesce", ["get", "fillColor"], MAP_DEFAULT_STYLE.fillColor],
				"circle-stroke-color": ["coalesce", ["get", "strokeColor"], MAP_DEFAULT_STYLE.strokeColor],
				"circle-stroke-width": ["coalesce", ["get", "strokeWidth"], MAP_DEFAULT_STYLE.strokeWidth],
			},
		});
		map.addLayer({
			id: "viewer-labels",
			type: "symbol",
			source: "viewer-features",
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
		map.doubleClickZoom.disable();
		setMapReady(true);
		map.setLayoutProperty("basemap-osm", "visibility", basemap === "osm" ? "visible" : "none");
		map.setLayoutProperty("basemap-satellite", "visibility", basemap === "satellite" ? "visible" : "none");
	};

	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}

		const webglSupport = checkWebGLSupport();
		if (!webglSupport.supported) {
			setWebglError(getWebGLErrorMessage(webglSupport));
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

		let map: MapLibreMap;
		try {
			map = new maplibregl.Map({
				container,
				style: baseStyle,
				center: [15, 45],
				zoom: 13,
				bearing: 0,
				pitch: 0,
				dragRotate: false,
				pitchWithRotate: false,
				attributionControl: false,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to initialize map";
			if (message.includes("WebGL") || message.includes("context")) {
				setWebglError("WebGL is not available. Please enable hardware acceleration in your browser settings.");
			} else {
				setWebglError(message);
			}
			return;
		}

		mapRef.current = map;
		map.dragRotate.disable();
		map.touchZoomRotate.disableRotation();
		map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");

		map.on("error", (e) => {
			const error = e.error;
			if (error?.message?.includes("WebGL") || error?.message?.includes("context")) {
				setWebglError("WebGL context lost. Try refreshing the page.");
			}
		});

		map.on("load", mapLayersReady);
		return () => {
			setMapReady(false);
			map.remove();
			if (mapRef.current === map) {
				mapRef.current = null;
			}
		};
	}, []);

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
		const source = map.getSource("viewer-features") as GeoJSONSource;
		if (!source) {
			return;
		}
		source.setData(snapshot.collection || emptyCollection);
	}, [mapReady, snapshot.collection]);

	useEffect(() => {
		if (!mapReady) {
			return;
		}
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
				{ padding: 40, animate: false },
			);
			return;
		}
		const bounds = collectionBounds(snapshot.collection);
		if (bounds) {
			map.fitBounds(bounds, { padding: 40, animate: false });
		}
	}, [mapReady, playArea, snapshot.collection]);

	useEffect(() => {
		if (!mapReady) {
			return;
		}
		const map = mapRef.current;
		if (!map) {
			return;
		}

		// Update label opacity
		map.setPaintProperty("viewer-labels", "text-halo-color", `rgba(0,0,0,${labelOpacity * 0.8})`);
		map.setPaintProperty("viewer-labels", "text-color", `rgba(255,255,255,${labelOpacity})`);

		const canvas = gridCanvasRef.current;
		if (!canvas) {
			return;
		}
		const gridSettings = {
			visible: gridVisible,
			labelsVisible: gridLabelsVisible,
			opacity: gridOpacity,
			labelOpacity: labelOpacity,
		};
		drawGrid(map, canvas, playArea, gridSettings);
		const onMove = () => {
			drawGrid(map, canvas, playArea, gridSettings);
		};
		map.on("move", onMove);
		map.on("zoom", onMove);
		return () => {
			map.off("move", onMove);
			map.off("zoom", onMove);
		};
	}, [mapReady, playArea, gridVisible, gridLabelsVisible, gridOpacity, labelOpacity]);

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
		for (let index = 0; index < snapshot.collection.features.length; index += 1) {
			const feature = snapshot.collection.features[index];
			if (!feature) {
				continue;
			}
			if (!feature.geometry || feature.geometry.type !== "Point") {
				continue;
			}
			const coords = feature.geometry.coordinates as [number, number] | undefined;
			if (!coords || coords.length !== 2) {
				continue;
			}
			const props = (feature.properties as Record<string, unknown> | undefined) || {};
			const iconNameValue = props.iconName;
			const iconName = typeof iconNameValue === "string" && iconNameValue.length > 0 ? iconNameValue : "map-pin";
			const iconBackgroundValue = props.iconBackground;
			const iconBackground =
				typeof iconBackgroundValue === "boolean" ? iconBackgroundValue : MAP_DEFAULT_STYLE.fillOpacity > 0;
			const iconSizeValue = props.iconSize;
			const iconSize = typeof iconSizeValue === "number" ? iconSizeValue : 22;
			const strokeColorValue = props.strokeColor;
			const strokeColor =
				typeof strokeColorValue === "string" && strokeColorValue.length > 0
					? strokeColorValue
					: MAP_DEFAULT_STYLE.strokeColor;
			const fillColorValue = props.fillColor;
			const fillColor =
				typeof fillColorValue === "string" && fillColorValue.length > 0
					? fillColorValue
					: MAP_DEFAULT_STYLE.fillColor;
			const idValue = props.id;
			const id =
				typeof idValue === "string" && idValue.length > 0
					? idValue
					: `${coords[0]}-${coords[1]}-${iconName}-${iconSize}`;
			nextIds.add(id);
			const existing = markers.get(id);
			const scale = zoomScale;
			if (existing) {
				existing.marker.setLngLat(coords as LngLatLike);
				existing.root.render(
					<PointMarker
						name={iconName}
						color={strokeColor}
						fill={iconBackground ? fillColor : "transparent"}
						background={iconBackground}
						scale={scale}
						size={iconSize}
					/>,
				);
				existing.size = iconSize;
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
					color={strokeColor}
					fill={iconBackground ? fillColor : "transparent"}
					background={iconBackground}
					scale={scale}
					size={iconSize}
				/>,
			);
			const marker = new maplibregl.Marker({ element: el, draggable: false })
				.setLngLat(coords as LngLatLike)
				.addTo(map);
			markers.set(id, { marker, root, size: iconSize });
		}
		for (const [id, entry] of markers.entries()) {
			if (!nextIds.has(id)) {
				entry.marker.remove();
				markers.delete(id);
				queueMicrotask(() => entry.root.unmount());
			}
		}
	}, [mapReady, snapshot.collection.features]);

	useEffect(() => {
		if (!mapReady) {
			return;
		}
		const map = mapRef.current;
		if (!map) {
			return;
		}
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
		map.on("zoom", onZoom);
		return () => {
			map.off("zoom", onZoom);
			const entries = Array.from(markers.values());
			markers.clear();
			for (const entry of entries) {
				entry.marker.remove();
				queueMicrotask(() => entry.root.unmount());
			}
		};
	}, [mapReady]);

	const containerStyle = typeof height === "number" ? { height: `${height}px` } : { height };

	if (webglError) {
		return (
			<div
				className={cn(
					"relative w-full overflow-hidden rounded-lg border bg-muted/50 flex items-center justify-center",
					className,
				)}
				style={containerStyle}
			>
				<div className="flex flex-col items-center gap-3 p-6 text-center max-w-md">
					<AlertCircle className="h-10 w-10 text-muted-foreground" />
					<div>
						<h3 className="font-semibold text-lg">Map Unavailable</h3>
						<p className="text-sm text-muted-foreground mt-1">{webglError}</p>
					</div>
					<p className="text-xs text-muted-foreground">
						Try enabling hardware acceleration in your browser settings, or use a different browser.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className={cn("relative w-full overflow-hidden rounded-lg border", className)} style={containerStyle}>
			<div ref={containerRef} className="h-full w-full" />
			<canvas ref={gridCanvasRef} className="pointer-events-none absolute inset-0" />
			<ViewerControlsPanel
				gridVisible={gridVisible}
				onGridVisibleChange={setGridVisible}
				gridLabelsVisible={gridLabelsVisible}
				onGridLabelsVisibleChange={setGridLabelsVisible}
				gridOpacity={gridOpacity}
				onGridOpacityChange={setGridOpacity}
				labelOpacity={labelOpacity}
				onLabelOpacityChange={setLabelOpacity}
				basemap={basemap}
				onBasemapChange={setBasemap}
			/>
		</div>
	);
}

export default MapViewer;
