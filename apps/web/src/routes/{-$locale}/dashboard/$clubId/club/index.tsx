import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import { ClubOverview } from "@/components/overviews/club-overview";
import apiServer from "@/lib/api/api";
import { fetchClubReviews } from "@/lib/server/club-page";

const getClubFn = createServerFn({ method: "GET" })
	.validator(z.object({ clubId: z.string() }))
	.handler(async ({ data }) => {
		const { data: club } = await apiServer.GET("/api/clubs/{id}", { params: { path: { id: data.clubId } } });
		return club ? { club, reviews: await fetchClubReviews(data.clubId) } : null;
	});

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/club/")({
	loader: async ({ params }) => {
		const page = await getClubFn({ data: { clubId: params.clubId } });
		if (!page) {
			throw notFound();
		}
		return page;
	},
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: ClubPage,
});

function ClubPage() {
	const { club, reviews } = Route.useLoaderData();
	const { access } = Route.useRouteContext();

	return (
		<ClubOverview
			club={club}
			isManager={access.isManager}
			isMember={access.isMember}
			currentUserMembership={access.membership}
			reviews={reviews}
		/>
	);
}
