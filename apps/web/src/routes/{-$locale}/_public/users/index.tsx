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
import { createItemListWithUsers } from "@/lib/json-ld";
import { buildSeoHead, type SeoInput } from "@/lib/seo";
import { getCountryNames } from "@/lib/server/country-names";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";
import { UsersListing } from "@/routes/{-$locale}/_public/users/-components/users-listing";
import {
	toUsersQuery,
	USERS_PER_PAGE,
	type UsersSearch,
	usersSearchSchema,
} from "@/routes/{-$locale}/_public/users/-components/users-search";

/** Players have no country or city of their own, so the filter lists come from the clubs. */
async function getFilterOptions(locale: string) {
	const [clubsResult, names, citiesResult] = await Promise.all([
		apiServer.GET("/api/clubs", {
			params: { query: { perPage: "100", sortBy: "name", sortOrder: "asc", facets: "true" } },
		}),
		getCountryNames(locale),
		apiServer.GET("/api/public/cities"),
	]);
	return {
		countries: (clubsResult.data?.facets?.country ?? []).map((entry) => ({
			id: entry.countryId,
			name: names.get(entry.countryId) ?? String(entry.countryId),
		})),
		clubs: (clubsResult.data?.clubs ?? []).map((club) => ({ id: club.id, name: club.name })),
		cities: (citiesResult.data?.cities ?? []).map((city) => ({ slug: city.citySlug, name: city.city })),
	};
}

const getUsersPageFn = createServerFn({ method: "GET" })
	.validator(z.object({ search: usersSearchSchema, locale: z.string() }))
	.handler(async ({ data: { search, locale } }) => {
		const page = search.page ?? 1;
		const t = await getExtracted({ locale });
		const baseUrl = env.NEXT_PUBLIC_WEB_URL || "";
		const seo: SeoInput = {
			title: t("Airsoft Players Directory - Find & Connect with Players on RECONNED"),
			description: t(
				"Browse airsoft player profiles and connect with the community. Find players by location, experience level, and club membership. Build your airsoft network today.",
			),
			keywords: t(
				"airsoft players, airsoft gamers, airsoft community members, find airsoft player, airsoft player profiles, airsoft player BiH, airsoft player Bosnia, airsoft player directory",
			)
				.split(",")
				.map((keyword: string) => keyword.trim())
				.join(", "),
			canonical: constructCanonicalUrl(baseUrl, "/users", locale),
			languages: generatePageLanguages(baseUrl, "/users", locale),
		};

		const { data, error } = await apiServer.GET("/api/users", {
			params: { query: toUsersQuery(search, USERS_PER_PAGE) },
		});

		if (error || !data) {
			return { kind: "error" as const, seo };
		}

		const itemListSchema = createItemListWithUsers({
			users: data.users.map((user) => ({
				id: user.id,
				slug: user.slug,
				name: user.name,
				image: user.image,
				callsign: user.callsign,
				location: user.location,
				clubMembership: user.clubMembership?.map((membership) => ({
					clubId: membership.club.id,
					clubSlug: membership.club.slug || null,
					clubName: membership.club.name,
				})),
			})),
			page,
			itemsPerPage: USERS_PER_PAGE,
			total: data.pagination.total,
			locale,
			name: t("Airsoft players - RECONNED"),
			description: t(
				"The list of all airsoft players on the platform. The first universal platform for airsoft clubs, events, and players.",
			),
		});

		return {
			kind: "ok" as const,
			listing: { users: data.users, pagination: data.pagination, ...(await getFilterOptions(locale)) },
			seo: { ...seo, schemas: [JSON.stringify(itemListSchema)] },
		};
	});

export const Route = createFileRoute("/{-$locale}/_public/users/")({
	validateSearch: usersSearchSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: ({ deps, context }) => getUsersPageFn({ data: { search: deps.search, locale: context.locale } }),
	head: ({ loaderData }) => (loaderData ? buildSeoHead(loaderData.seo) : {}),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: UsersPage,
});

function UsersPage() {
	const t = useExtracted();
	const page = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	if (page.kind === "error") {
		return <ErrorPage title={t("Error loading users")} />;
	}

	const update = (patch: Partial<UsersSearch>) =>
		navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }), replace: true });

	return (
		<UsersListing
			data={page.listing}
			search={search}
			onSearchChange={update}
			onPageChange={(next) => navigate({ search: (prev) => ({ ...prev, page: next > 1 ? next : undefined }) })}
			onReset={() => navigate({ search: {}, replace: true })}
		/>
	);
}
