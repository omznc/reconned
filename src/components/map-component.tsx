"use client";

import {
	FeatureGroup,
	LayerGroup,
	type Map as LeafletMap,
	Marker,
	type PM,
	Polygon,
	Rectangle,
	divIcon,
	marker,
	polygon,
} from "leaflet";
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { Pin } from "lucide-react";
import reactDomServer from "react-dom/server";

interface Poi {
	lat: number;
	lng: number;
}

interface MapData {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	areas: any[];
	pois: Poi[];
}

interface MapComponentProps {
	defaultMapData?: MapData;
	onSaveMapData?: (data: MapData) => void;
	readOnly?: boolean;
}

const generatePinIcon = () => {
	const iconHtml = reactDomServer.renderToString(
		<div style={{ color: "red" }}>
			<Pin size={24} />
		</div>,
	);

	return divIcon({
		html: iconHtml,
		iconSize: [24, 24],
		iconAnchor: [12, 24],
	});
};

export const MapComponent = ({
	defaultMapData,
	onSaveMapData,
	readOnly = false,
}: MapComponentProps) => {
	const mapRef = useRef<LeafletMap | null>(null);
	const drawnItemsRef = useRef<FeatureGroup | null>(null);
	const [mapData, setMapData] = useState<MapData>(
		defaultMapData || { areas: [], pois: [] },
	);

	useEffect(() => {
		if (!mapRef.current) return;

		drawnItemsRef.current = new FeatureGroup();
		// Clear all layers
		mapRef.current.eachLayer((layer) => {
			if (layer instanceof LayerGroup) {
				layer.clearLayers();
			}
		});
		mapRef.current.addLayer(drawnItemsRef.current);

		if (!readOnly) {
			mapRef.current.pm.addControls({
				position: "topleft",
				drawMarker: true,
				drawPolygon: true,
				drawPolyline: false,
				drawCircle: false,
				drawCircleMarker: false,
				drawRectangle: true,
				editMode: false,
				cutPolygon: false,
				dragMode: false,
				cutCircle: false,
				deleteLayer: true,
				drawText: false,
			});
		}
	}, [readOnly]);

	useEffect(() => {
		if (!(mapRef.current && drawnItemsRef.current && defaultMapData)) return;

		const { areas, pois } = defaultMapData;

		drawnItemsRef.current.clearLayers();
		mapRef.current.eachLayer((layer) => {
			if (layer instanceof LayerGroup) {
				layer.clearLayers();
			}
		});

		// Load areas
		for (const area of areas) {
			const swappedCoordinates = area.map((ring: number[][]) =>
				ring.map((coord: number[]) => [coord[1], coord[0]]),
			);
			polygon(swappedCoordinates).addTo(drawnItemsRef.current);
		}

		// Load points of interest (POIs)
		for (const poi of pois) {
			marker([poi.lat, poi.lng], { icon: generatePinIcon() }).addTo(
				drawnItemsRef.current,
			);
		}
	}, [defaultMapData]);

	useEffect(() => {
		if (!mapRef.current || readOnly) return;

		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		const handleDrawCreated = (event: any) => {
			const layer = event.layer;
			drawnItemsRef.current?.addLayer(layer);

			const newMapData = { ...mapData };

			if (layer instanceof Marker) {
				const latlng = layer.getLatLng();
				newMapData.pois.push({ lat: latlng.lat, lng: latlng.lng });
			} else if (layer instanceof Polygon || layer instanceof Rectangle) {
				newMapData.areas.push(layer.toGeoJSON().geometry.coordinates);
			}

			setMapData(newMapData);
			onSaveMapData?.(newMapData);
		};

		const handleDrawDeleted: PM.CreateEventHandler = (event) => {
			const layers = event.layer;

			const newMapData = { ...mapData };

			if (layers instanceof Marker) {
				const latlng = layers.getLatLng();
				newMapData.pois = newMapData.pois.filter(
					(poi) => poi.lat !== latlng.lat || poi.lng !== latlng.lng,
				);
			} else if (layers instanceof Polygon || layers instanceof Rectangle) {
				const coordinates = layers.toGeoJSON().geometry.coordinates;
				newMapData.areas = newMapData.areas.filter(
					(area) => JSON.stringify(area) !== JSON.stringify(coordinates),
				);
			}

			setMapData(newMapData);
			onSaveMapData?.(newMapData);
		};

		mapRef.current.on("pm:create", handleDrawCreated);
		mapRef.current.on("pm:remove", handleDrawDeleted);

		// Cleanup on unmount or when mapRef changes
		return () => {
			mapRef.current?.off("pm:create", handleDrawCreated);
			mapRef.current?.off("pm:remove", handleDrawDeleted);
		};
	}, [mapRef, mapData, onSaveMapData, readOnly]); // Added readOnly as dependency

	const calculateCenter = () => {
		if (defaultMapData && defaultMapData.areas.length > 0) {
			let latSum = 0;
			let lngSum = 0;
			let coordCount = 0;

			for (const area of defaultMapData.areas) {
				for (const ring of area) {
					for (const [lng, lat] of ring) {
						latSum += lat;
						lngSum += lng;
						coordCount++;
					}
				}
			}

			return { lat: latSum / coordCount, lng: lngSum / coordCount };
		}
		return { lat: 43.8486, lng: 18.3564 };
	};

	const mapCenter = calculateCenter();

	return (
		<MapContainer
			center={mapCenter}
			zoom={13}
			ref={mapRef}
			style={{ height: "500px", width: "100%", zIndex: "0" }}
		>
			<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
		</MapContainer>
	);
};
