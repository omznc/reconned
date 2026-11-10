import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { ErrorPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import { ClubProfile } from "@/components/profile/club-profile";
import { CLUB_TABS } from "@/components/profile/profile-config";
import { buildNotFoundHead } from "@/lib/not-found";
import { buildSeoHead } from "@/lib/seo";
import { loadClubPage } from "@/lib/server/club-page";

const getClubPageFn = createServerFn({ method: "GET" })
	.validator(z.object({ id: z.string(), locale: z.string(), signedIn: z.boolean() }))
	.handler(async ({ data }) => await loadClubPage(data));

export const Route = createFileRoute("/{-$locale}/_public/clubs/$id")({
	validateSearch: z.object({ tab: z.enum(CLUB_TABS).optional().catch(undefined) }),
	loader: async ({ params, context }) => {
		const page = await getClubPageFn({
			data: { id: params.id, locale: context.locale, signedIn: Boolean(context.user) },
		});
		if (page.kind === "not-found") {
			throw notFound();
		}
		return page;
	},
	head: ({ loaderData }) => {
		if (loaderData?.kind !== "ok") {
			return buildNotFoundHead("Club not found.");
		}
		return buildSeoHead(loaderData.seo);
	},
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: ClubPage,
});

function ClubPage() {
	const t = useExtracted();
	const page = Route.useLoaderData();
	const { tab } = Route.useSearch();
	const { user } = Route.useRouteContext();

	if (page.kind !== "ok") {
		return <ErrorPage title={t("Club not found.")} />;
	}

	const { club, extras } = page;

	return <ClubProfile club={club} extras={extras} user={user} tab={tab ?? "overview"} />;
}
