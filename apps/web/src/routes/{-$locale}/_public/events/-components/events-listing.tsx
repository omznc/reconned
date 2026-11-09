import { CalendarDays, List } from "lucide-react";
import { useExtracted } from "next-intl";
import { useQueryStates } from "nuqs";
import type { ComponentProps } from "react";
import { EventCalendar } from "@/components/event-calendar";
import { type ListingChip, ListingShell, ViewToggle } from "@/components/redesign/listing-shell";
import {
	type EventsFacets,
	EventsFilters,
	type FilterPatch,
	type FilterValues,
} from "@/routes/{-$locale}/_public/events/-components/events-filters";
import { EventsResults, type ListedEvent } from "@/routes/{-$locale}/_public/events/-components/events-results";
import {
	type EventsSort,
	eventsParsers,
	MAX_PER_PAGE,
	perPageFor,
	SORTS,
	VIEWS,
} from "@/routes/{-$locale}/_public/events/-components/events-search";

export interface EventsListingData {
	events: ListedEvent[];
	total: number;
	facets: EventsFacets | null;
	upcomingCount: number;
	openThisWeekendCount: number;
	calendarEvents: ComponentProps<typeof EventCalendar>["events"];
}

type UrlState = ReturnType<typeof useQueryStates<typeof eventsParsers>>[0];

function useViewOptions() {
	const t = useExtracted();
	return [
		{ value: "list", label: t("List"), icon: List },
		{ value: "calendar", label: t("Calendar"), icon: CalendarDays },
	];
}

function useSortOptions() {
	const t = useExtracted();
	const labels: Record<EventsSort, string> = {
		soonest: t("Soonest first"),
		placesLeft: t("Most places left"),
		price: t("Lowest price"),
	};
	return SORTS.map((value) => ({ value, label: labels[value] }));
}

function Subtitle({ data }: { data: EventsListingData }) {
	const t = useExtracted();
	return t(
		"{upcoming, plural, one {# upcoming game} other {# upcoming games}} · {weekend, plural, one {# open this weekend} other {# open this weekend}}",
		{ upcoming: data.upcomingCount, weekend: data.openThisWeekendCount },
	);
}

function useDateChips(state: UrlState, update: (patch: FilterPatch) => void) {
	const t = useExtracted();
	const chips: ListingChip[] = [];
	if (state.when) {
		const label = state.when === "weekend" ? t("This weekend") : t("Next 30 days");
		chips.push({ key: "when", label, onRemove: () => update({ when: null }) });
	}
	if (state.from || state.to) {
		chips.push({
			key: "dates",
			label: `${state.from ?? "…"} – ${state.to ?? "…"}`,
			onRemove: () => update({ from: null, to: null }),
		});
	}
	return chips;
}

function useChips(state: UrlState, facets: EventsFacets | null, update: (patch: FilterPatch) => void) {
	const t = useExtracted();
	const registration = {
		open: t("Open"),
		notOpenYet: t("Not open yet"),
		full: t("Full"),
		closed: t("Closed"),
	};
	const chips: ListingChip[] = useDateChips(state, update);
	for (const reg of state.reg) {
		chips.push({
			key: `reg-${reg}`,
			label: registration[reg],
			onRemove: () => update({ reg: state.reg.filter((entry) => entry !== reg) }),
		});
	}
	for (const id of state.country) {
		chips.push({
			key: `country-${id}`,
			label: facets?.country.find((country) => country.countryId === id)?.name ?? t("Country"),
			onRemove: () => update({ country: state.country.filter((entry) => entry !== id) }),
		});
	}
	return [...chips, ...useAttributeChips(state, update)];
}

function useAttributeChips(state: UrlState, update: (patch: FilterPatch) => void) {
	const t = useExtracted();
	const chips: ListingChip[] = [];
	if (state.city) {
		chips.push({ key: "city", label: state.city, onRemove: () => update({ city: "" }) });
	}
	if (state.maxPrice !== null) {
		chips.push({
			key: "price",
			label: t("Up to {price} KM", { price: String(state.maxPrice) }),
			onRemove: () => update({ maxPrice: null }),
		});
	}
	if (state.freelancers) {
		chips.push({
			key: "freelancers",
			label: t("Freelancers welcome"),
			onRemove: () => update({ freelancers: false }),
		});
	}
	if (state.verified) {
		chips.push({ key: "verified", label: t("Verified clubs only"), onRemove: () => update({ verified: false }) });
	}
	return chips;
}

/** A change of a filter shows the first page again. */
function useEventsUrlState() {
	const [state, setState] = useQueryStates(eventsParsers);
	const update = (patch: FilterPatch) => {
		setState({ ...patch, page: null });
	};
	const reset = () => {
		setState({
			q: null,
			when: null,
			from: null,
			to: null,
			reg: null,
			country: null,
			city: null,
			maxPrice: null,
			freelancers: null,
			verified: null,
			page: null,
		});
	};
	return { state, setState, update, reset };
}

function toFilterValues(state: UrlState): FilterValues {
	return {
		when: state.when,
		from: state.from,
		to: state.to,
		reg: state.reg,
		country: state.country,
		city: state.city,
		maxPrice: state.maxPrice,
		freelancers: state.freelancers,
		verified: state.verified,
	};
}

export function EventsListing({ data }: { data: EventsListingData }) {
	const t = useExtracted();
	const viewOptions = useViewOptions();
	const sortOptions = useSortOptions();
	const { state, setState, update, reset } = useEventsUrlState();
	const chips = useChips(state, data.facets, update);

	const viewToggle = (
		<ViewToggle
			label={t("View")}
			options={viewOptions}
			value={state.view}
			onChange={(value) => setState({ view: VIEWS.find((view) => view === value) ?? "list" })}
		/>
	);

	if (state.view === "calendar") {
		return (
			<div className="container max-w-7xl px-4 py-8">
				<div className="mb-5 flex flex-wrap items-end justify-between gap-4">
					<div className="flex flex-col gap-1">
						<h1 className="text-[28px] leading-[34px] font-bold tracking-tight md:text-[40px] md:leading-[46px]">
							{t("Events")}
						</h1>
						<p className="text-[13px] leading-5 text-muted-foreground tabular-nums">
							<Subtitle data={data} />
						</p>
					</div>
					{viewToggle}
				</div>
				<EventCalendar events={data.calendarEvents} />
			</div>
		);
	}

	const shown = data.events.length;
	return (
		<div className="container max-w-7xl px-4 py-8">
			<ListingShell
				title={t("Events")}
				subtitle={<Subtitle data={data} />}
				viewToggle={viewToggle}
				search={{
					value: state.q,
					onChange: (value) => setState({ q: value, page: null }),
					placeholder: t("Event, club or city"),
					label: t("Search events"),
				}}
				sort={{
					value: state.sort,
					onChange: (value) =>
						setState({ sort: SORTS.find((sort) => sort === value) ?? "soonest", page: null }),
					options: sortOptions,
				}}
				chips={chips}
				resultCount={data.total}
				filters={<EventsFilters values={toFilterValues(state)} facets={data.facets} onChange={update} />}
				activeFilterCount={chips.length}
				onResetFilters={reset}
			>
				<EventsResults
					events={data.events}
					total={data.total}
					canLoadMore={shown < data.total && perPageFor(state.page) < MAX_PER_PAGE}
					onLoadMore={() => setState({ page: state.page + 1 }, { history: "replace" })}
					hasFilters={chips.length > 0 || state.q !== ""}
					onReset={reset}
				/>
			</ListingShell>
		</div>
	);
}
