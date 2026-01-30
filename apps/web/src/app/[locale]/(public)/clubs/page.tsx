import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { ClubsListing } from "@/app/[locale]/(public)/clubs/_components/clubs-listing";
import { ErrorPage } from "@/components/error-page";
import JsonLdScript from "@/components/json-ld-script";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { createItemListWithClubs } from "@/lib/json-ld";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

const ITEMS_PER_PAGE = 12;

export const dynamic = "force-dynamic";

export default async function Page(props: PageProps<"/[locale]/clubs">) {
	const [searchParams, locale] = await Promise.all([props.searchParams, getLocale()]);
	const t = await getExtracted();
	const page = Number(searchParams.page) || 1;

	const { data, error } = await apiServer.GET("/api/clubs", {
		params: {
			query: {
				page: String(page),
				perPage: String(ITEMS_PER_PAGE),
			},
		},
	});

	if (error || !data) {
		return <ErrorPage title={t("Error loading clubs")} />;
	}

	const initialData = {
		clubs: data.clubs,
		pagination: data.pagination,
	};

	const itemListSchema = createItemListWithClubs({
		clubs: data.clubs.map((club) => ({
			id: club.id,
			slug: club.slug,
			name: club.name,
			description: club.description,
			logo: club.logo,
			location: club.location,
			latitude: club.latitude,
			longitude: club.longitude,
			contactEmail: club.contactEmail,
			contactPhone: club.contactPhone,
			dateFounded: club.dateFounded,
			verified: club.verified,
		})),
		page,
		itemsPerPage: ITEMS_PER_PAGE,
		total: data.pagination.total,
		locale,
		name: t("Airsoft clubs - RECONNED"),
		description: t(
			"The list of all airsoft clubs on the platform. The first universal platform for airsoft clubs, events, and players.",
		),
	});

	return (
		<>
			<JsonLdScript data={itemListSchema} />
			<ClubsListing initialData={initialData} />
		</>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();
	const locale = await getLocale();

	return {
		title: t("Airsoft Clubs Directory - Find & Join Teams on RECONNED"),
		description: t(
			"Discover airsoft clubs across Bosnia and Herzegovina. Browse verified teams, view member profiles, and join clubs near you. Connect with the local airsoft community today.",
		),
		keywords: t(
			"airsoft clubs, airsoft teams, airsoft club directory, find airsoft club, join airsoft club, airsoft club BiH, airsoft club Bosnia, airsoft club Sarajevo, airsoft club members, airsoft club registration",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("Airsoft Clubs Directory - Find & Join Teams on RECONNED"),
			description: t(
				"Discover airsoft clubs across Bosnia and Herzegovina. Browse verified teams, view member profiles, and join clubs near you. Connect with the local airsoft community today.",
			),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/clubs", locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("Airsoft Clubs Directory - Find & Join Teams on RECONNED"),
			description: t(
				"Discover airsoft clubs across Bosnia and Herzegovina. Browse verified teams, view member profiles, and join clubs near you. Connect with the local airsoft community today.",
			),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/clubs", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_WEB_URL || "", "/clubs", locale),
		},
	};
}
