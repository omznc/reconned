import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
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
import { asJson } from "@/lib/server/json";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";
import { EventsListing } from "@/routes/{-$locale}/_public/events/-components/events-listing";

const ITEMS_PER_PAGE = 12;

const getEventsPageFn = createServerFn({ method: "GET" })
	.validator(z.object({ page: z.number(), locale: z.string() }))
	.handler(async ({ data: { page, locale } }) => {
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

		const { data, error } = await apiServer.GET("/api/events", {
			params: {
				query: {
					page: String(page),
					perPage: String(ITEMS_PER_PAGE),
					sortBy: "dateStart",
					sortOrder: "asc",
				},
			},
		});

		if (error || !data) {
			return { kind: "error" as const, seo };
		}

		const itemListSchema = createItemListWithEvents({
			events: data.events.map((event) => {
				const club = (event as Record<string, unknown>).club as
					| {
							id: string;
							name: string;
							slug: string | null;
							logo: string | null;
					  }
					| undefined;
				return {
					id: event.id,
					slug: event.slug,
					name: event.name,
					description: event.description,
					image: event.image,
					dateStart: event.dateStart,
					dateEnd: event.dateEnd,
					location: event.location,
					...(club && {
						clubId: club.id,
						clubSlug: club.slug,
						clubName: club.name,
						clubLogo: club.logo,
					}),
				};
			}),
			page,
			itemsPerPage: ITEMS_PER_PAGE,
			total: data.pagination.total,
			locale,
			name: t("Airsoft events - RECONNED"),
			description: t(
				"The list of all airsoft events on the platform. The first universal platform for airsoft clubs, events, and players.",
			),
		});

		return {
			kind: "ok" as const,
			initialData: { events: asJson(data.events), pagination: data.pagination },
			seo: { ...seo, schemas: [JSON.stringify(itemListSchema)] },
		};
	});

export const Route = createFileRoute("/{-$locale}/_public/events/")({
	validateSearch: z.looseObject({ page: z.coerce.number().optional().catch(undefined) }),
	loaderDeps: ({ search }) => ({ page: Number(search.page) || 1 }),
	loader: ({ deps, context }) => getEventsPageFn({ data: { page: deps.page, locale: context.locale } }),
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

	return <EventsListing initialData={page.initialData} />;
}
