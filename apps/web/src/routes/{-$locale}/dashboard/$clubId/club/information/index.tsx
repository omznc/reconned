import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { ClubInfoForm } from "@/routes/{-$locale}/dashboard/$clubId/club/information/-components/club-info.form";

const getClubInformationFn = createServerFn({ method: "GET" })
	.validator(z.object({ clubId: z.string() }))
	.handler(async ({ data }) => {
		const path = { id: data.clubId };
		const [club, countries, authUrl] = await Promise.all([
			apiServer.GET("/api/clubs/{id}/information", { params: { path } }),
			apiServer.GET("/api/countries"),
			apiServer.GET("/api/clubs/{id}/instagram/auth-url", { params: { path } }),
		]);
		if (!(club.data && countries.data)) {
			return null;
		}
		return { club: club.data, countries: countries.data, authUrl: authUrl.data?.authUrl || "" };
	});

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/club/information/")({
	loader: async ({ params }) => {
		const page = await getClubInformationFn({ data: { clubId: params.clubId } });
		if (!page) {
			throw notFound();
		}
		return page;
	},
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: InformationPage,
});

function InformationPage() {
	const { club, countries, authUrl } = Route.useLoaderData();

	return (
		<div className="p-6">
			<ClubInfoForm
				club={club}
				countries={countries}
				isClubOwner={club.isCurrentUserOwner}
				instagramConnectionUrl={authUrl}
			/>
		</div>
	);
}
