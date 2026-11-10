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
import { createItemListWithClubs } from "@/lib/json-ld";
import { buildSeoHead, type SeoInput } from "@/lib/seo";
import { getCountryNames } from "@/lib/server/country-names";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";
import { ClubsListing } from "@/routes/{-$locale}/_public/clubs/-components/clubs-listing";
import {
	CLUBS_PER_PAGE,
	type ClubsSearch,
	clubsSearchSchema,
	toClubsQuery,
} from "@/routes/{-$locale}/_public/clubs/-components/clubs-search";

/** The country names and the city list for the filters. A failed lookup gives an empty list. */
async function getFilterOptions(locale: string, countryIds: number[]) {
	const [names, citiesResult] = await Promise.all([getCountryNames(locale), apiServer.GET("/api/public/cities")]);
	return {
		countries: countryIds.map((id) => ({ id, name: names.get(id) ?? String(id) })),
		cities: (citiesResult.data?.cities ?? []).map((city) => ({
			slug: city.citySlug,
			name: city.city,
			count: city.clubCount,
		})),
	};
}

const getClubsPageFn = createServerFn({ method: "GET" })
	.validator(z.object({ search: clubsSearchSchema, locale: z.string() }))
	.handler(async ({ data: { search, locale } }) => {
		const page = search.page ?? 1;
		const t = await getExtracted({ locale });
		const baseUrl = env.NEXT_PUBLIC_WEB_URL || "";
		const seo: SeoInput = {
			title: t("Airsoft Clubs Directory - Find & Join Teams on RECONNED"),
			description: t(
				"Discover airsoft clubs across Bosnia and Herzegovina. Browse verified teams, view member profiles, and join clubs near you. Connect with the local airsoft community today.",
			),
			keywords: t(
				"airsoft clubs, airsoft teams, airsoft club directory, find airsoft club, join airsoft club, airsoft club BiH, airsoft club Bosnia, airsoft club Sarajevo, airsoft club members, airsoft club registration",
			)
				.split(",")
				.map((keyword: string) => keyword.trim())
				.join(", "),
			canonical: constructCanonicalUrl(baseUrl, "/clubs", locale),
			languages: generatePageLanguages(baseUrl, "/clubs", locale),
		};

		const { data, error } = await apiServer.GET("/api/clubs", {
			params: { query: toClubsQuery(search, CLUBS_PER_PAGE) },
		});

		if (error || !data) {
			return { kind: "error" as const, seo };
		}

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
			itemsPerPage: CLUBS_PER_PAGE,
			total: data.pagination.total,
			locale,
			name: t("Airsoft clubs - RECONNED"),
			description: t(
				"The list of all airsoft clubs on the platform. The first universal platform for airsoft clubs, events, and players.",
			),
		});

		const options = await getFilterOptions(
			locale,
			(data.facets?.country ?? []).map((entry) => entry.countryId),
		);

		return {
			kind: "ok" as const,
			listing: {
				clubs: data.clubs,
				pagination: data.pagination,
				totals: data.totals,
				facets: data.facets,
				...options,
			},
			seo: { ...seo, schemas: [JSON.stringify(itemListSchema)] },
		};
	});

export const Route = createFileRoute("/{-$locale}/_public/clubs/")({
	validateSearch: clubsSearchSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: ({ deps, context }) => getClubsPageFn({ data: { search: deps.search, locale: context.locale } }),
	head: ({ loaderData }) => (loaderData ? buildSeoHead(loaderData.seo) : {}),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: ClubsPage,
});

function ClubsPage() {
	const t = useExtracted();
	const page = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	if (page.kind === "error") {
		return <ErrorPage title={t("Error loading clubs")} />;
	}

	const update = (patch: Partial<ClubsSearch>) =>
		navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }), replace: true });

	return (
		<ClubsListing
			data={page.listing}
			search={search}
			onSearchChange={update}
			onPageChange={(next) => navigate({ search: (prev) => ({ ...prev, page: next > 1 ? next : undefined }) })}
			onReset={() => navigate({ search: {}, replace: true })}
		/>
	);
}
