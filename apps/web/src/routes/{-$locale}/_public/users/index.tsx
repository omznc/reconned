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
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";
import { UsersListing } from "@/routes/{-$locale}/_public/users/-components/users-listing";

const ITEMS_PER_PAGE = 12;

const getUsersPageFn = createServerFn({ method: "GET" })
	.validator(z.object({ page: z.number(), locale: z.string() }))
	.handler(async ({ data: { page, locale } }) => {
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
			params: {
				query: {
					page: String(page),
					perPage: String(ITEMS_PER_PAGE),
					sort: "admin",
				},
			},
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
			itemsPerPage: ITEMS_PER_PAGE,
			total: data.pagination.total,
			locale,
			name: t("Airsoft players - RECONNED"),
			description: t(
				"The list of all airsoft players on the platform. The first universal platform for airsoft clubs, events, and players.",
			),
		});

		return {
			kind: "ok" as const,
			initialData: { users: data.users, pagination: data.pagination },
			seo: { ...seo, schemas: [JSON.stringify(itemListSchema)] },
		};
	});

export const Route = createFileRoute("/{-$locale}/_public/users/")({
	validateSearch: z.looseObject({ page: z.coerce.number().optional().catch(undefined) }),
	loaderDeps: ({ search }) => ({ page: Number(search.page) || 1 }),
	loader: ({ deps, context }) => getUsersPageFn({ data: { page: deps.page, locale: context.locale } }),
	head: ({ loaderData }) => (loaderData ? buildSeoHead(loaderData.seo) : {}),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: UsersPage,
});

function UsersPage() {
	const t = useExtracted();
	const page = Route.useLoaderData();

	if (page.kind === "error") {
		return <ErrorPage title={t("Error loading users")} />;
	}

	return <UsersListing initialData={page.initialData} />;
}
