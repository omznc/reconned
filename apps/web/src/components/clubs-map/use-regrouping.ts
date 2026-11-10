import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { MapClub } from "@/components/clubs-map/clubs-map";
import { toGroupingZoom } from "@/components/clubs-map/geo";
import {
	type ClubGroup,
	FAR_ZOOM,
	GHOST_LIFETIME,
	groupClubs,
	MOTION_STAGGER_MAX,
	type PinEntity,
	type PinGhost,
	type PinMotion,
	pinEntities,
	planRegrouping,
} from "@/components/clubs-map/grouping";

/**
 * Regroups on zoom. Panning is deliberately not a trigger: groups are computed in
 * projected space, so they are identical wherever the viewport sits. Each regroup
 * also plans the motion that lets the viewer follow it.
 */
export function useRegrouping(map: MapLibreMap | null, shown: MapClub[]) {
	const [groups, setGroups] = useState<ClubGroup[]>([]);
	const [far, setFar] = useState(false);
	const [enterMotion, setEnterMotion] = useState<Map<string, PinMotion>>(() => new Map());
	const [ghosts, setGhosts] = useState<PinGhost[]>([]);
	const lastEntities = useRef<PinEntity[] | null>(null);
	const ghostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!map) return;

		const regroup = () => {
			const zoom = toGroupingZoom(map.getZoom());
			const next = groupClubs(shown, zoom);
			const entities = pinEntities(next);
			const previous = lastEntities.current;
			lastEntities.current = entities;

			setGroups(next);
			setFar(zoom <= FAR_ZOOM);

			// The first layout has nothing to have come from, so its pins just appear.
			if (!previous) return;

			const { enter, ghosts: leaving } = planRegrouping(zoom, previous, entities);
			setEnterMotion(enter);
			setGhosts(leaving);

			if (ghostTimer.current) clearTimeout(ghostTimer.current);
			if (leaving.length > 0) {
				ghostTimer.current = setTimeout(() => setGhosts([]), GHOST_LIFETIME + MOTION_STAGGER_MAX);
			}
		};

		regroup();
		map.on("zoomend", regroup);

		return () => {
			map.off("zoomend", regroup);
			if (ghostTimer.current) clearTimeout(ghostTimer.current);
		};
	}, [map, shown]);

	return { groups, far, enterMotion, ghosts };
}
