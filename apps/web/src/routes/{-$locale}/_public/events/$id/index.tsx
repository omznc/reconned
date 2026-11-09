import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import * as z from "zod";
import { ErrorPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import { EventOverview } from "@/components/overviews/event-overview";
import apiServer from "@/lib/api/api";
import { buildNotFoundHead, readNotFoundData } from "@/lib/not-found";
import { buildSeoHead } from "@/lib/seo";
import { buildEventSeo, buildSchemas, fetchEventViewerData, fetchReviews, toEvent } from "@/lib/server/event-page";
import { asJson } from "@/lib/server/json";

const getEventPageFn = createServerFn({ method: "GET" })
	.validator(z.object({ id: z.string(), locale: z.string(), signedIn: z.boolean() }))
	.handler(async ({ data: { id, locale, signedIn } }) => {
		const {
			data: eventData,
			error,
			response,
		} = await apiServer.GET("/api/events/{id}", {
			params: { path: { id } },
		});

		// See the club page: a deleted or mistyped event has to answer 404 so it leaves
		// the index, while a backend failure keeps rendering an error page instead.
		if (response.status === 404) {
			const t = await getExtracted({ locale });
			return { kind: "not-found" as const, title: t("Event Not Found - RECONNED") };
		}
		if (error || !eventData || !eventData.club) {
			return { kind: "error" as const };
		}

		const event = asJson(toEvent({ ...eventData, club: eventData.club }));
		const reviews = await fetchReviews(event.id);
		const [schemas, viewer] = await Promise.all([
			buildSchemas(event, locale, reviews),
			fetchEventViewerData(eventData.club.id, signedIn),
		]);
		return {
			kind: "ok" as const,
			event,
			clubId: eventData.club.id,
			placesLeft: eventData.placesLeft,
			reviews: reviews?.reviews,
			...viewer,
			seo: await buildEventSeo(event, locale, schemas),
		};
	});

export const Route = createFileRoute("/{-$locale}/_public/events/$id/")({
	loader: async ({ params, context }) => {
		const page = await getEventPageFn({
			data: { id: params.id, locale: context.locale, signedIn: Boolean(context.user) },
		});
		if (page.kind === "not-found") {
			throw notFound({ data: { title: page.title, description: "" } });
		}
		return page;
	},
	head: ({ loaderData, match }) => {
		if (loaderData?.kind !== "ok") {
			// The translated title travels on the thrown `notFound`; the literal is the fallback for a backend error.
			return buildNotFoundHead(readNotFoundData(match.error)?.title ?? "Event Not Found - RECONNED");
		}
		return buildSeoHead(loaderData.seo);
	},
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: EventPage,
});

function EventPage() {
	const t = useExtracted();
	const page = Route.useLoaderData();
	const { user } = Route.useRouteContext();

	if (page.kind !== "ok") {
		return <ErrorPage title={t("Event Not Found - RECONNED")} />;
	}

	return (
		<div className="flex flex-col size-full gap-8 max-w-[1200px] py-8  px-4">
			<EventOverview
				event={page.event}
				clubId={page.clubId}
				user={user}
				role={page.role}
				eventRegistrationEnabled={page.eventRegistrationEnabled}
				reviews={page.reviews}
				placesLeft={page.placesLeft}
			/>
		</div>
	);
}
