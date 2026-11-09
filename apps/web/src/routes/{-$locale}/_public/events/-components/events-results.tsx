import { useExtracted, useLocale } from "next-intl";
import { EventRow, type EventRowState } from "@/components/redesign/event-row";
import { toDate } from "@/components/redesign/format-event-date";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { DEFAULT_TIME_ZONE } from "@/i18n/routing";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { toIntlLocale } from "@/lib/intl-locale";

export type ListedEvent = ApiResponse<"/api/events", "get">["events"][number];

const STATE: Record<ListedEvent["registrationState"], EventRowState> = {
	open: "open",
	notOpenYet: "pending",
	closed: "closed",
	full: "full",
};

function dayKey(value: string) {
	return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIME_ZONE }).format(toDate(value));
}

function dayHeading(value: string, locale: string) {
	return new Intl.DateTimeFormat(toIntlLocale(locale), {
		timeZone: DEFAULT_TIME_ZONE,
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(toDate(value));
}

/** Groups only neighbours of the same day, so a sort by price keeps its order. */
function groupByDay(events: ListedEvent[]) {
	const groups: { key: string; start: string; items: ListedEvent[] }[] = [];
	for (const event of events) {
		const key = dayKey(event.dateStart);
		const last = groups.at(-1);
		if (last?.key === key) {
			last.items.push(event);
		} else {
			groups.push({ key: `${key}-${groups.length}`, start: event.dateStart, items: [event] });
		}
	}
	return groups;
}

function tileOf(value: string | null) {
	return value === "paper" || value === "ink" ? value : null;
}

function ResultRow({ event }: { event: ListedEvent }) {
	const slug = event.slug || event.id;
	return (
		<EventRow
			href={`/events/${slug}`}
			applyHref={`/events/${slug}/apply`}
			name={event.name}
			dateStart={event.dateStart}
			dateEnd={event.dateEnd}
			variant="thumb"
			image={event.image}
			state={STATE[event.registrationState]}
			club={
				event.club
					? {
							name: event.club.name,
							logo: event.club.logo,
							logoTile: tileOf(event.club.logoTile),
							verified: event.club.verified,
						}
					: undefined
			}
			place={event.city ?? event.location}
			freelancers={event.allowFreelancers}
			placesLeft={event.placesLeft}
			maxAttendees={event.capacity}
			price={event.price}
			currency={event.currency}
		/>
	);
}

interface EventsResultsProps {
	events: ListedEvent[];
	total: number;
	canLoadMore: boolean;
	onLoadMore: () => void;
	hasFilters: boolean;
	onReset: () => void;
}

function EmptyState({ hasFilters, onReset }: Pick<EventsResultsProps, "hasFilters" | "onReset">) {
	const t = useExtracted();
	return (
		<div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center">
			<p className="font-medium">{hasFilters ? t("No events match these filters") : t("No upcoming events")}</p>
			<p className="max-w-sm text-sm text-muted-foreground">
				{hasFilters
					? t("Change or remove a filter to see more events.")
					: t("Clubs post their events here as soon as the dates are set.")}
			</p>
			{hasFilters ? (
				<Button type="button" variant="outline" onClick={onReset}>
					{t("Reset filters")}
				</Button>
			) : (
				<Link href="/clubs" className="text-sm underline underline-offset-4">
					{t("Browse clubs")}
				</Link>
			)}
		</div>
	);
}

export function EventsResults({ events, total, canLoadMore, onLoadMore, hasFilters, onReset }: EventsResultsProps) {
	const t = useExtracted();
	const locale = useLocale();
	if (events.length === 0) {
		return <EmptyState hasFilters={hasFilters} onReset={onReset} />;
	}
	return (
		<>
			{groupByDay(events).map(({ key, start, items }) => (
				<section key={key} className="flex flex-col gap-3" aria-labelledby={`day-${key}`}>
					<h2 id={`day-${key}`} className="flex items-baseline gap-2 px-0.5 pt-3 text-base font-semibold">
						{dayHeading(start, locale)}
						<span className="text-xs font-normal text-muted-foreground">
							{t("{count, plural, one {# game} other {# games}}", { count: items.length })}
						</span>
					</h2>
					{items.map((event) => (
						<ResultRow key={event.id} event={event} />
					))}
				</section>
			))}
			<nav className="flex items-center justify-between gap-3 pt-2" aria-label={t("Pagination")}>
				<span className="text-xs text-muted-foreground tabular-nums">
					{t("Showing {shown} of {total}", { shown: String(events.length), total: String(total) })}
				</span>
				{canLoadMore ? (
					<Button type="button" variant="outline" size="sm" onClick={onLoadMore}>
						{t("Load more")}
					</Button>
				) : null}
			</nav>
		</>
	);
}
