import type { Metadata } from "next";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { EventsListing } from "@/app/[locale]/(public)/events/_components/events-listing";
import { ErrorPage } from "@/components/error-page";
import JsonLdScript from "@/components/json-ld-script";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { createItemListWithEvents } from "@/lib/json-ld";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

export const revalidate = 300;

const ITEMS_PER_PAGE = 12;

export default async function Page(props: PageProps<"/[locale]/events">) {
	const [{ locale }, searchParams] = await Promise.all([props.params, props.searchParams]);
	setRequestLocale(locale);
	const t = await getExtracted();
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
		next: { revalidate: 300 },
	});

	if (error || !data) {
		return <ErrorPage title={t("Error loading events")} />;
	}

	const initialData = {
		events: data.events,
		pagination: data.pagination,
	};

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

	return (
		<>
			<JsonLdScript data={itemListSchema} />
			<EventsListing initialData={initialData} />
		</>
	);
}

export async function generateMetadata(props: PageProps<"/[locale]/events">): Promise<Metadata> {
	const { locale } = await props.params;
	setRequestLocale(locale);
	const t = await getExtracted();

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
