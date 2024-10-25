"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

interface Poi {
	lat: number;
	lng: number;
}

interface MapData {
	areas: any[];
	pois: Poi[];
}

interface MapComponentProps {
	defaultMapData?: MapData;
	onSaveMapData: (data: MapData) => void;
}

const MapComponent = ({ defaultMapData, onSaveMapData }: MapComponentProps) => {
	const mapRef = useRef<L.Map | null>(null);
	const [mapData, setMapData] = useState<MapData>(
		defaultMapData || { areas: [], pois: [] },
	);

	// Load default map data on mount
	useEffect(() => {
		if (!mapRef.current) return;

		const drawnItems = new L.FeatureGroup();
		mapRef.current.addLayer(drawnItems);

		// Load existing data into map
		if (defaultMapData) {
			const { areas, pois } = defaultMapData;

			// Clear existing layers if necessary
			drawnItems.clearLayers();

			for (const area of areas) {
				const swappedCoordinates = area.map((ring: any) =>
					ring.map((coord: any) => [coord[1], coord[0]]),
				);

				L.polygon(swappedCoordinates).addTo(drawnItems);
			}

			for (const poi of pois) {
				L.marker([poi.lat, poi.lng]).addTo(drawnItems);
			}
		}

		// Set up leaflet-geoman controls
		mapRef.current.pm.addControls({
			position: 'topleft',
			drawCircle: false,
			drawMarker: true,
			drawPolygon: true,
			drawPolyline: false,
			drawRectangle: true,
			editMode: true,
			deleteLayer: true,
		});

		// Handle creation of new areas/markers
		const handleDrawCreated = (event: any) => {
			const layer = event.layer;
			drawnItems.addLayer(layer);

			const newMapData = { ...mapData };

			if (layer instanceof L.Marker) {
				const latlng = layer.getLatLng();
				newMapData.pois.push({ lat: latlng.lat, lng: latlng.lng });
			} else if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
				newMapData.areas.push(layer.toGeoJSON().geometry.coordinates);
			}

			// Update the component's map data and invoke the callback
			setMapData(newMapData);
			onSaveMapData(newMapData);
		};

		mapRef.current.on("pm:create", handleDrawCreated);

		// Cleanup the event listener on unmount
		return () => {
			mapRef.current?.off("pm:create", handleDrawCreated);
		};
	}, [defaultMapData, mapData, onSaveMapData]);

	const calculateCenter = () => {
		if (defaultMapData && defaultMapData?.areas?.length > 0) {
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
		// Default to a specific location if no areas provided
		return { lat: 43.8486, lng: 18.3564 };
	};

	const mapCenter = calculateCenter();

	return (
		<MapContainer
			center={mapCenter}
			zoom={13}
			ref={mapRef}
			style={{ height: "500px", width: "100%" }}
		>
			<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
		</MapContainer>
	);
};

export default MapComponent;
