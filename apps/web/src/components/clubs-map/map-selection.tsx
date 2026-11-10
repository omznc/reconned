"use client";

import { ChevronRight, X } from "lucide-react";
import { useExtracted } from "next-intl";
import type { MapClub } from "@/components/clubs-map/clubs-map";
import type { LatLng } from "@/components/clubs-map/geo";
import { ClubCompactCard } from "@/components/clubs-map/map-panels";
import { VerifiedClubIcon } from "@/components/icons";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { Button } from "@/components/ui/button";

/**
 * What the map has open. A group that zooming can't resolve opens as a list
 * rather than a single club, so a shared pin never hides the clubs behind it.
 */
export type MapSelection = { kind: "club"; club: MapClub } | { kind: "group"; key: string; clubs: MapClub[] };

/** The point the map should keep in view for the current selection. */
export function selectionCenter(selection: MapSelection): LatLng | null {
	const clubs = selection.kind === "club" ? [selection.club] : selection.clubs;
	for (const club of clubs) {
		if (typeof club.latitude === "number" && typeof club.longitude === "number") {
			return [club.latitude, club.longitude];
		}
	}
	return null;
}

/**
 * The answer to a pin that can't be split: the clubs sharing that coordinate,
 * listed, each one a step into its own card.
 */
function GroupClubList({ clubs, onSelect }: { clubs: MapClub[]; onSelect: (club: MapClub) => void }) {
	const t = useExtracted();
	const location = clubs.find((club) => club.location)?.location;

	return (
		<div className="flex flex-col gap-3 p-4">
			<div className="flex flex-col gap-0.5 pr-8">
				<h3 className="font-semibold text-lg">{t("{count} clubs here", { count: clubs.length.toString() })}</h3>
				<p className="text-muted-foreground text-sm">{location ?? t("These clubs share the same location")}</p>
			</div>

			<div className="-mx-1 flex max-h-[45dvh] flex-col gap-0.5 overflow-y-auto md:max-h-72">
				{clubs.map((club) => (
					<button
						key={club.id}
						type="button"
						onClick={() => onSelect(club)}
						className="flex touch-manipulation items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted"
					>
						<ClubAvatar
							name={club.name}
							logo={club.logo}
							tile={club.logoTile}
							size={36}
							className="shrink-0"
						/>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-1.5">
								<span className="truncate font-medium">{club.name}</span>
								{club.verified && <VerifiedClubIcon />}
							</div>
							{club.location && (
								<div className="truncate text-muted-foreground text-sm">{club.location}</div>
							)}
						</div>
						<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
					</button>
				))}
			</div>
		</div>
	);
}

export function SelectionBody({
	selection,
	onSelect,
	onClose,
}: {
	selection: MapSelection;
	onSelect: (club: MapClub) => void;
	onClose: () => void;
}) {
	const t = useExtracted();
	if (selection.kind === "group") {
		return (
			<div className="relative">
				<Button
					variant="ghost"
					size="sm"
					aria-label={t("Close")}
					className="absolute top-2 right-2 z-1 size-8 p-0"
					onClick={onClose}
				>
					<X className="size-4" aria-hidden={true} />
				</Button>
				<GroupClubList clubs={selection.clubs} onSelect={onSelect} />
			</div>
		);
	}
	return <ClubCompactCard club={selection.club} onClose={onClose} />;
}
