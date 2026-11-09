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
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";
import { ClubsListing } from "@/routes/{-$locale}/_public/clubs/-components/clubs-listing";

const ITEMS_PER_PAGE = 12;

const getClubsPageFn = createServerFn({ method: "GET" })
	.validator(z.object({ page: z.number(), locale: z.string() }))
	.handler(async ({ data: { page, locale } }) => {
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
			params: {
				query: {
					page: String(page),
					perPage: String(ITEMS_PER_PAGE),
				},
			},
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
			itemsPerPage: ITEMS_PER_PAGE,
			total: data.pagination.total,
			locale,
			name: t("Airsoft clubs - RECONNED"),
			description: t(
				"The list of all airsoft clubs on the platform. The first universal platform for airsoft clubs, events, and players.",
			),
		});

		return {
			kind: "ok" as const,
			initialData: { clubs: data.clubs, pagination: data.pagination },
			seo: { ...seo, schemas: [JSON.stringify(itemListSchema)] },
		};
	});

export const Route = createFileRoute("/{-$locale}/_public/clubs/")({
	validateSearch: z.looseObject({ page: z.coerce.number().optional().catch(undefined) }),
	loaderDeps: ({ search }) => ({ page: Number(search.page) || 1 }),
	loader: ({ deps, context }) => getClubsPageFn({ data: { page: deps.page, locale: context.locale } }),
	head: ({ loaderData }) => (loaderData ? buildSeoHead(loaderData.seo) : {}),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: ClubsPage,
});

function ClubsPage() {
	const t = useExtracted();
	const page = Route.useLoaderData();

	if (page.kind === "error") {
		return <ErrorPage title={t("Error loading clubs")} />;
	}

	return <ClubsListing initialData={page.initialData} />;
}
