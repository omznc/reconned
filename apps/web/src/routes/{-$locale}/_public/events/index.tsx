import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { addMonths, endOfMonth, parse as parseDateFns, startOfMonth, subMonths } from "date-fns";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import * as z from "zod";
import { ErrorPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { createItemListWithEvents } from "@/lib/json-ld";
import { buildSeoHead, type SeoInput } from "@/lib/seo";
import { getCountryNames } from "@/lib/server/country-names";
import { asJson } from "@/lib/server/json";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";
import { EventsListing } from "@/routes/{-$locale}/_public/events/-components/events-listing";
import {
	type EventsQuery,
	eventsSearchSchema,
	perPageFor,
	sortParams,
	toEventsQuery,
} from "@/routes/{-$locale}/_public/events/-components/events-search";

async function fetchCalendarEvents(month: string | undefined) {
	const current = month ? parseDateFns(month, "yyyy-MM", new Date()) : new Date();
	const { data } = await apiServer.GET("/api/events/calendar", {
		params: {
			query: {
				startDate: startOfMonth(subMonths(current, 1)).toISOString(),
				endDate: endOfMonth(addMonths(current, 1)).toISOString(),
			},
		},
	});
	return (data?.events ?? []).map((event) => ({ ...event, club: event.club || null }));
}

function fetchEventsList(query: EventsQuery, perPage: number) {
	return apiServer.GET("/api/events", {
		params: {
			query: {
				page: "1",
				perPage: String(perPage),
				facets: "true",
				search: query.search,
				...sortParams(query.sort),
				when: query.when,
				dateFrom: query.dateFrom,
				dateTo: query.dateTo,
				registration: query.registration.join(",") || undefined,
				countryId: query.countryId.join(",") || undefined,
				city: query.city,
				maxPrice: query.maxPrice,
				freelancers: query.freelancers ? "true" : undefined,
				verifiedOnly: query.verifiedOnly ? "true" : undefined,
			},
		},
	});
}

const getEventsPageFn = createServerFn({ method: "GET" })
	.validator(z.object({ locale: z.string(), search: eventsSearchSchema }))
	.handler(async ({ data: { search, locale } }) => {
		const query = toEventsQuery(search);
		const perPage = perPageFor(query.page);
		const t = await getExtracted({ locale });
		const baseUrl = env.NEXT_PUBLIC_WEB_URL || "";
		const seo: SeoInput = {
			title: t("Airsoft Events & Tournaments - Find & Join Games on RECONNED"),
			description: t(
				"Browse and join upcoming airsoft events, tournaments, and matches. Find games near you, register online, and connect with airsoft clubs across Bosnia and Herzegovina.",
			),
			keywords: t(
				"airsoft events, airsoft matches, airsoft tournaments, airsoft games, airsoft competitions, find airsoft event, join airsoft event, airsoft event BiH, airsoft event Bosnia, airsoft event registration",
			)
				.split(",")
				.map((keyword: string) => keyword.trim())
				.join(", "),
			canonical: constructCanonicalUrl(baseUrl, "/events", locale),
			languages: generatePageLanguages(baseUrl, "/events", locale),
		};

		const [{ data, error }, calendarEvents, countryNames] = await Promise.all([
			fetchEventsList(query, perPage),
			query.view === "calendar" ? fetchCalendarEvents(query.month) : Promise.resolve([]),
			getCountryNames(locale),
		]);

		if (error || !data) {
			return { kind: "error" as const, seo };
		}

		const itemListSchema = createItemListWithEvents({
			events: data.events.map((event) => ({
				id: event.id,
				slug: event.slug,
				name: event.name,
				description: event.description,
				image: event.image,
				dateStart: event.dateStart,
				dateEnd: event.dateEnd,
				location: event.location,
				...(event.club && {
					clubId: event.club.id,
					clubSlug: event.club.slug,
					clubName: event.club.name,
					clubLogo: event.club.logo,
				}),
			})),
			page: 1,
			itemsPerPage: perPage,
			total: data.pagination.total,
			locale,
			name: t("Airsoft events - RECONNED"),
			description: t(
				"The list of all airsoft events on the platform. The first universal platform for airsoft clubs, events, and players.",
			),
		});

		return {
			kind: "ok" as const,
			events: asJson(data.events),
			total: data.pagination.total,
			// The facet carries the English name; show the name in the page's language.
			facets: data.facets
				? {
						...data.facets,
						country: data.facets.country.map((entry) => ({
							...entry,
							name: countryNames.get(entry.countryId) ?? entry.name,
						})),
					}
				: null,
			upcomingCount: data.upcomingCount ?? 0,
			openThisWeekendCount: data.openThisWeekendCount ?? 0,
			calendarEvents: asJson(calendarEvents),
			seo: { ...seo, schemas: [JSON.stringify(itemListSchema)] },
		};
	});

export const Route = createFileRoute("/{-$locale}/_public/events/")({
	validateSearch: eventsSearchSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: ({ deps, context }) => getEventsPageFn({ data: { search: deps.search, locale: context.locale } }),
	head: ({ loaderData }) => (loaderData ? buildSeoHead(loaderData.seo) : {}),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: EventsPage,
});

function EventsPage() {
	const t = useExtracted();
	const page = Route.useLoaderData();

	if (page.kind === "error") {
		return <ErrorPage title={t("Error loading events")} />;
	}

	return <EventsListing data={page} />;
}
