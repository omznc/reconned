"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";
import "leaflet-draw";

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

			areas.forEach((area) => {
				const polygon = L.polygon(area[0]).addTo(drawnItems); // Ensure area is a nested array
			});

			pois.forEach((poi) => {
				L.marker([poi.lat, poi.lng]).addTo(drawnItems);
			});
		}

		// Set up leaflet-draw controls
		const drawControl = new L.Control.Draw({
			edit: { featureGroup: drawnItems },
			draw: { circle: false, circlemarker: false },
		});
		mapRef.current.addControl(drawControl);

		// Handle creation of new areas/markers
		const handleDrawCreated = (event: L.Draw.Event) => {
			const layer = event.layer;
			drawnItems.addLayer(layer);

			const newMapData = { ...mapData };

			if (event.layerType === "marker") {
				const latlng = layer.getLatLng();
				newMapData.pois.push({ lat: latlng.lat, lng: latlng.lng });
			} else if (
				event.layerType === "polygon" ||
				event.layerType === "rectangle"
			) {
				newMapData.areas.push(layer.toGeoJSON().geometry.coordinates);
			}

			// Update the component's map data and invoke the callback
			setMapData(newMapData);
			onSaveMapData(newMapData);
		};

		mapRef.current.on(L.Draw.Event.CREATED, handleDrawCreated);

		// Cleanup the event listener on unmount
		return () => {
			mapRef.current?.off(L.Draw.Event.CREATED, handleDrawCreated);
		};
	}, [defaultMapData, mapData, onSaveMapData]);

	return (
		<MapContainer
			center={[43.8486, 18.3564]}
			zoom={13}
			ref={mapRef}
			style={{ height: "500px", width: "100%" }}
		>
			<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
		</MapContainer>
	);
};

export default MapComponent;
