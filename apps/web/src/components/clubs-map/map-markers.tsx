"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useState } from "react";
import {
	CLUB_MARKER,
	type ClubIconLabels,
	ClubPin,
	GROUP_MARKER,
	GroupPin,
	type PinState,
} from "@/components/clubs-map/club-pins";
import type { MapClub } from "@/components/clubs-map/clubs-map";
import type { LatLng } from "@/components/clubs-map/geo";
import { type ClubGroup, groupHint, type PinGhost, type PinMotion } from "@/components/clubs-map/grouping";
import { MapMarker } from "@/components/clubs-map/map-marker";
import type { MapSelection } from "@/components/clubs-map/map-selection";
import { SpreadLines } from "@/components/clubs-map/spread-lines";

const Z_SELECTED = 2000;
const Z_HOVERED = 1000;
const Z_GHOST = -1000;

interface ClubMarkersProps {
	map: MapLibreMap;
	groups: ClubGroup[];
	ghosts: PinGhost[];
	enterMotion: Map<string, PinMotion>;
	far: boolean;
	dark: boolean;
	selection: MapSelection | null;
	labels: ClubIconLabels;
	onSelectClub: (club: MapClub) => void;
	onOpenGroup: (group: ClubGroup) => void;
}

function pinState(selected: boolean, hovered: boolean): PinState {
	if (selected) return "selected";
	return hovered ? "hovered" : "default";
}

function zIndexFor(selected: boolean, hovered: boolean): number {
	if (selected) return Z_SELECTED;
	return hovered ? Z_HOVERED : 0;
}

interface ClubMarkerProps {
	map: MapLibreMap;
	club: MapClub;
	position: LatLng;
	far: boolean;
	selected: boolean;
	hovered: boolean;
	labels: ClubIconLabels;
	motion?: PinMotion;
	onHover: (hovered: boolean) => void;
	onSelect: (club: MapClub) => void;
}

function ClubMarker({
	map,
	club,
	position,
	far,
	selected,
	hovered,
	labels,
	motion,
	onHover,
	onSelect,
}: ClubMarkerProps) {
	return (
		<MapMarker
			map={map}
			position={position}
			{...CLUB_MARKER}
			zIndex={zIndexFor(selected, hovered)}
			onHover={onHover}
			onClick={() => onSelect(club)}
		>
			<ClubPin club={club} far={far} state={pinState(selected, hovered)} labels={labels} motion={motion} />
		</MapMarker>
	);
}

/** Just the ghosts: inert pins that the last regroup removed, kept on screen until they have left. */
function GhostMarkers({ map, ghosts, far, labels }: Pick<ClubMarkersProps, "map" | "ghosts" | "far" | "labels">) {
	return ghosts.map((ghost) => {
		const first = ghost.clubs[0];
		if (!first) return null;

		return (
			<MapMarker
				key={`ghost-${ghost.id}`}
				map={map}
				position={ghost.at}
				{...(ghost.group ? GROUP_MARKER : CLUB_MARKER)}
				zIndex={Z_GHOST}
				inert={true}
			>
				{ghost.group ? (
					<GroupPin count={ghost.clubs.length} far={far} hovered={false} hint="" motion={ghost.motion} />
				) : (
					<ClubPin club={first} far={far} state="default" labels={labels} motion={ghost.motion} />
				)}
			</MapMarker>
		);
	});
}

export function ClubMarkers(props: ClubMarkersProps) {
	const { map, groups, ghosts, enterMotion, far, dark, selection, labels, onSelectClub, onOpenGroup } = props;
	const [hoveredKey, setHoveredKey] = useState<string | null>(null);
	const hoverOf = (key: string) => (on: boolean) => setHoveredKey(on ? key : null);
	const selectedClubId = selection?.kind === "club" ? selection.club.id : null;

	return (
		<>
			<SpreadLines map={map} groups={groups} dark={dark} />
			{groups.map((group) => {
				const first = group.clubs[0];
				if (!first) return null;

				// Fanned out: the pins sit on a ring, tethered to the shared coordinate.
				if (group.spread) {
					return group.spread.map(({ club, position }) => {
						const memberKey = `${group.key}::${club.id}`;
						return (
							<ClubMarker
								key={memberKey}
								map={map}
								club={club}
								position={position}
								far={false}
								selected={selectedClubId === club.id}
								hovered={hoveredKey === memberKey}
								labels={labels}
								motion={enterMotion.get(memberKey)}
								onHover={hoverOf(memberKey)}
								onSelect={onSelectClub}
							/>
						);
					});
				}

				if (group.clubs.length > 1) {
					const openAsList = selection?.kind === "group" && selection.key === group.key;
					const hovered = hoveredKey === group.key;
					return (
						<MapMarker
							key={group.key}
							map={map}
							position={group.center}
							{...GROUP_MARKER}
							zIndex={zIndexFor(openAsList, hovered)}
							onHover={hoverOf(group.key)}
							onClick={() => onOpenGroup(group)}
						>
							<GroupPin
								count={group.clubs.length}
								far={far}
								hovered={hovered || openAsList}
								hint={groupHint(group, labels)}
								motion={enterMotion.get(group.key)}
							/>
						</MapMarker>
					);
				}

				return (
					<ClubMarker
						key={group.key}
						map={map}
						club={first}
						position={group.center}
						far={far}
						selected={selectedClubId === first.id}
						hovered={hoveredKey === group.key}
						labels={labels}
						motion={enterMotion.get(group.key)}
						onHover={hoverOf(group.key)}
						onSelect={onSelectClub}
					/>
				);
			})}
			<GhostMarkers map={map} ghosts={ghosts} far={far} labels={labels} />
		</>
	);
}
