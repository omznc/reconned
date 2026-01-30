import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { EventsListing } from "@/app/[locale]/(public)/events/_components/events-listing";
import { ErrorPage } from "@/components/error-page";
import JsonLdScript from "@/components/json-ld-script";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { createItemListWithEvents } from "@/lib/json-ld";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ITEMS_PER_PAGE = 12;

export default async function Page(props: PageProps<"/[locale]/events">) {
	const locale = await getLocale();
	const t = await getExtracted();
	const searchParams = await props.searchParams;
	const page = Number(searchParams.page) || 1;

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
		return <ErrorPage title={t("Error loading events")} />;
	}

	const initialData = {
		events: data.events,
		pagination: data.pagination,
	};

	const uniqueClubIds = [...new Set(data.events.map((e) => e.clubId).filter(Boolean))];
	const clubDataMap = new Map<string, { id: string; name: string; slug: string | null; logo: string | null }>();

	await Promise.all(
		uniqueClubIds.map(async (clubId) => {
			const clubResponse = await apiServer.GET("/api/clubs/{id}", {
				params: {
					path: { id: clubId },
				},
			});
			if (clubResponse.data) {
				clubDataMap.set(clubId, {
					id: clubResponse.data.id,
					name: clubResponse.data.name,
					slug: clubResponse.data.slug,
					logo: clubResponse.data.logo,
				});
			}
		}),
	);

	const itemListSchema = createItemListWithEvents({
		events: data.events.map((event) => {
			const club = event.clubId ? clubDataMap.get(event.clubId) : undefined;
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

	return (
		<>
			<JsonLdScript data={itemListSchema} />
			<EventsListing initialData={initialData} />
		</>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();
	const locale = await getLocale();

	return {
		title: t("Airsoft Events & Tournaments - Find & Join Games on RECONNED"),
		description: t(
			"Browse and join upcoming airsoft events, tournaments, and matches. Find games near you, register online, and connect with airsoft clubs across Bosnia and Herzegovina.",
		),
		keywords: t(
			"airsoft events, airsoft matches, airsoft tournaments, airsoft games, airsoft competitions, find airsoft event, join airsoft event, airsoft event BiH, airsoft event Bosnia, airsoft event registration",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("Airsoft Events & Tournaments - Find & Join Games on RECONNED"),
			description: t(
				"Browse and join upcoming airsoft events, tournaments, and matches. Find games near you, register online, and connect with airsoft clubs across Bosnia and Herzegovina.",
			),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/events", locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("Airsoft Events & Tournaments - Find & Join Games on RECONNED"),
			description: t(
				"Browse and join upcoming airsoft events, tournaments, and matches. Find games near you, register online, and connect with airsoft clubs across Bosnia and Herzegovina.",
			),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/events", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_WEB_URL || "", "/events", locale),
		},
	};
}
