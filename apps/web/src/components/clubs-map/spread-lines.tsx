"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useMemo } from "react";
import { GROUP_PLATE, PLATE } from "@/components/clubs-map/club-pins";
import type { ClubGroup } from "@/components/clubs-map/grouping";

const SOURCE = "club-fan";
const LINES = "club-fan-lines";
const ANCHORS = "club-fan-anchors";
// Same ink as the group plate on a light map, paper on a dark one.
const LEADER_LIGHT = GROUP_PLATE;
const LEADER_DARK = "#f4f2ee";

function fanData(groups: ClubGroup[]): GeoJSON.FeatureCollection {
	const features: GeoJSON.Feature[] = [];
	for (const group of groups) {
		if (!group.spread) continue;

		const [lat, lng] = group.center;
		features.push({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [lng, lat] } });
		for (const { position } of group.spread) {
			features.push({
				type: "Feature",
				properties: {},
				geometry: {
					type: "LineString",
					coordinates: [
						[lng, lat],
						[position[1], position[0]],
					],
				},
			});
		}
	}
	return { type: "FeatureCollection", features };
}

function addFanLayers(map: MapLibreMap, data: GeoJSON.FeatureCollection, dark: boolean) {
	if (map.getSource(SOURCE)) return;

	map.addSource(SOURCE, { type: "geojson", data });
	map.addLayer({
		id: LINES,
		type: "line",
		source: SOURCE,
		filter: ["==", "$type", "LineString"],
		paint: { "line-color": dark ? LEADER_DARK : LEADER_LIGHT, "line-width": 1.5, "line-opacity": 0.35 },
	});
	map.addLayer({
		id: ANCHORS,
		type: "circle",
		source: SOURCE,
		filter: ["==", "$type", "Point"],
		paint: {
			"circle-radius": 3,
			"circle-color": dark ? LEADER_DARK : LEADER_LIGHT,
			"circle-opacity": 0.9,
			"circle-stroke-color": dark ? LEADER_LIGHT : PLATE,
			"circle-stroke-width": 2,
			"circle-stroke-opacity": 0.9,
		},
	});
}

/**
 * The tether from each fanned pin back to the coordinate it really occupies, and the
 * dot they converge on. Drawn as map layers, so a style swap drops them and they are
 * added again on `style.load`.
 */
export function SpreadLines({ map, groups, dark }: { map: MapLibreMap; groups: ClubGroup[]; dark: boolean }) {
	const data = useMemo(() => fanData(groups), [groups]);

	useEffect(() => {
		// isStyleLoaded() is false while tiles load, so try instead: a style still parsing throws, and style.load retries.
		const add = () => {
			try {
				addFanLayers(map, data, dark);
			} catch {
				// Style not parsed yet.
			}
		};
		add();
		map.on("style.load", add);

		return () => {
			map.off("style.load", add);
			for (const id of [LINES, ANCHORS]) {
				if (map.getLayer(id)) map.removeLayer(id);
			}
			if (map.getSource(SOURCE)) map.removeSource(SOURCE);
		};
	}, [map, data, dark]);

	return null;
}
