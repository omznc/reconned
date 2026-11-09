import type { LucideIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";
import { EntityRow } from "@/components/redesign/entity-row";
import { EventRow } from "@/components/redesign/event-row";
import { Link } from "@/i18n/navigation";
import { eventState, type SearchParams, searchHref } from "@/routes/{-$locale}/_public/search/-components/search-state";
import type { ClubItem, EventItem, UserItem } from "@/routes/{-$locale}/_public/search/-components/use-search-data";

export function EventHit({ item }: { item: EventItem }) {
	const event = item.data;
	if (!event.dateStart) {
		return null;
	}
	return (
		<EventRow
			href={`/events/${event.slug || item.id}`}
			name={item.name}
			dateStart={event.dateStart}
			dateEnd={event.dateEnd}
			state={eventState({ ...event, placesLeft: event.placesLeft })}
			club={
				event.club ? { name: event.club.name, logo: event.club.logo, verified: event.club.verified } : undefined
			}
			place={event.location}
			freelancers={event.allowFreelancers}
			placesLeft={event.placesLeft}
			maxAttendees={event.maxAttendees}
			price={event.costPerPerson}
		/>
	);
}

export function ClubHit({ item }: { item: ClubItem }) {
	const t = useExtracted();
	const club = item.data;
	const members = t("{count} members", { count: String(club.memberCount) });
	return (
		<EntityRow
			kind="club"
			href={`/clubs/${club.slug || item.id}`}
			name={item.name}
			subtitle={[club.location, members].filter(Boolean).join(" · ")}
			image={club.logo}
			logoTile={club.logoTile}
			verified={club.verified}
		/>
	);
}

export function PlayerHit({ item }: { item: UserItem }) {
	const user = item.data;
	const callsign = user.callsign || item.name;
	const subtitle = [user.callsign ? item.name : null, user.mainClub?.name].filter(Boolean).join(" · ");
	return (
		<EntityRow
			kind="player"
			href={`/users/${user.slug || item.id}`}
			name={callsign}
			subtitle={subtitle || user.location}
			image={user.image}
		/>
	);
}

interface HitSectionProps {
	icon: LucideIcon;
	title: string;
	allLabel: string;
	params: SearchParams;
	tab: SearchParams["tab"];
	columns?: boolean;
	children: ReactNode;
}

/** A section of the "All" tab. The link switches to the tab of the type. */
export function HitSection({ icon: Icon, title, allLabel, params, tab, columns, children }: HitSectionProps) {
	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-3">
				<h2 className="flex items-center gap-2 text-base font-semibold">
					<Icon className="size-4 text-muted-foreground" aria-hidden={true} />
					{title}
				</h2>
				<Link
					href={searchHref(params, { tab })}
					className="rounded-md px-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					{allLabel}
				</Link>
			</div>
			<div className={columns ? "grid grid-cols-1 gap-2 xl:grid-cols-2" : "flex flex-col gap-2"}>{children}</div>
		</section>
	);
}
