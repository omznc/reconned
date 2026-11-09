import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { ErrorPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import { USER_TABS } from "@/components/profile/profile-config";
import { UserProfile } from "@/components/profile/user-profile";
import apiServer from "@/lib/api/api";
import { buildNotFoundHead } from "@/lib/not-found";
import { buildSeoHead } from "@/lib/seo";
import { buildUserSchemas, buildUserSeo, fetchUserReviews } from "@/lib/server/user-page";

const getUserPageFn = createServerFn({ method: "GET" })
	.validator(z.object({ id: z.string(), locale: z.string() }))
	.handler(async ({ data: { id, locale } }) => {
		const {
			data: user,
			error,
			response,
		} = await apiServer.GET("/api/users/{id}/profile", {
			params: { path: { id } },
		});

		// See the club page: a missing profile has to answer 404 so it leaves the index,
		// while a backend failure keeps rendering an error page instead.
		if (response.status === 404) {
			return { kind: "not-found" as const };
		}
		if (error || !user) {
			return { kind: "error" as const };
		}

		const reviews = await fetchUserReviews(user.id);
		const schemas = await buildUserSchemas(user, locale, reviews);
		return { kind: "ok" as const, user, reviews, seo: buildUserSeo(user, locale, schemas) };
	});

export const Route = createFileRoute("/{-$locale}/_public/users/$id")({
	validateSearch: z.object({ tab: z.enum(USER_TABS).optional().catch(undefined) }),
	loader: async ({ params, context }) => {
		const page = await getUserPageFn({ data: { id: params.id, locale: context.locale } });
		if (page.kind === "not-found") {
			throw notFound();
		}
		return page;
	},
	head: ({ loaderData }) => {
		if (loaderData?.kind !== "ok") {
			return buildNotFoundHead("User not found.");
		}
		return buildSeoHead(loaderData.seo);
	},
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: UserPage,
});

function UserPage() {
	const t = useExtracted();
	const page = Route.useLoaderData();
	const { tab } = Route.useSearch();

	if (page.kind !== "ok") {
		return <ErrorPage title={t("User not found.")} />;
	}

	return <UserProfile user={page.user} reviews={page.reviews} tab={tab ?? "overview"} />;
}
