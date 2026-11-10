import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { isAfter, isBefore } from "date-fns";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import type { CollectionPage, WithContext } from "schema-dts";
import * as z from "zod";
import { ErrorPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import { redirect } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { env } from "@/lib/env";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { buildSeoHead, type SeoInput } from "@/lib/seo";
import { asJson } from "@/lib/server/json";
import { getFeatureFlagsFn } from "@/lib/server-fns";
import { constructCanonicalUrl, generateHreflangAlternatesForSluggableEntity } from "@/lib/utils";
import { EventApplicationForm } from "@/routes/{-$locale}/_public/events/$id/-components/event-application.form";

type ApplyData = ApiResponse<"/api/events/{id}/apply-data", "get">;

async function buildApplySeo(event: ApplyData["event"], locale: string) {
	const t = await getExtracted({ locale });
	const pathPrefix = "/events";
	const baseUrl = env.NEXT_PUBLIC_WEB_URL || "";
	return {
		title: t("Apply to {eventName} - RECONNED", { eventName: event.name }),
		description: t("Apply to participate in {eventName}", { eventName: event.name }),
		canonical: constructCanonicalUrl(baseUrl, `${pathPrefix}/${event.slug || event.id}/apply`, locale),
		languages: generateHreflangAlternatesForSluggableEntity(
			baseUrl,
			pathPrefix,
			event.id,
			locale,
			event.slug || undefined,
		),
	} satisfies SeoInput;
}

const getApplyPageFn = createServerFn({ method: "GET" })
	.validator(z.object({ id: z.string(), locale: z.string() }))
	.handler(async ({ data: { id, locale } }) => {
		if (!(await isFeatureEnabled("EVENT_REGISTRATION"))) {
			return { kind: "disabled" as const };
		}

		const { data: applyData, error: applyError } = await apiServer.GET("/api/events/{id}/apply-data", {
			params: { path: { id } },
		});
		if (applyError || !applyData) {
			return { kind: "event-not-found" as const };
		}

		const { event, existingRegistration, capacity } = applyData;
		const t = await getExtracted({ locale });
		const seo = await buildApplySeo(event, locale);

		const { data: clubsData, error: clubsError } = await apiServer.GET("/api/users/me/clubs", {});
		if (clubsError || !clubsData) {
			return { kind: "load-failed" as const };
		}

		const canApplyToEvent =
			isAfter(new Date(), new Date(event.dateRegistrationsOpen)) &&
			isBefore(new Date(), new Date(event.dateRegistrationsClose));
		if (!canApplyToEvent) {
			return { kind: "closed" as const, eventId: event.id, seo };
		}

		const eventUrl = `${env.NEXT_PUBLIC_WEB_URL}/events/${event.slug || event.id}`;
		const applicationPageSchema: WithContext<CollectionPage> = {
			"@context": "https://schema.org",
			"@type": "CollectionPage",
			"@id": `${eventUrl}/apply`,
			name: `${existingRegistration ? t("Edit event application") : t("Apply to event")}: ${event.name}`,
			description: t("Applying to {eventName}", { eventName: event.name }),
			url: `${eventUrl}/apply`,
			mainEntity: {
				"@type": "SportsEvent",
				"@id": eventUrl,
				name: event.name,
				sport: "Airsoft",
				startDate: event.dateStart,
				endDate: event.dateEnd,
				url: eventUrl,
			},
			breadcrumb: {
				"@type": "BreadcrumbList",
				itemListElement: [
					{ "@type": "ListItem", position: 1, name: "Home", item: env.NEXT_PUBLIC_WEB_URL },
					{ "@type": "ListItem", position: 2, name: "Events", item: `${env.NEXT_PUBLIC_WEB_URL}/events` },
					{ "@type": "ListItem", position: 3, name: event.name, item: eventUrl },
					{ "@type": "ListItem", position: 4, name: "Apply", item: `${eventUrl}/apply` },
				],
			},
		};

		return {
			kind: "ok" as const,
			event: asJson(event),
			existingRegistration: asJson(existingRegistration),
			capacity: asJson(capacity),
			currentUserClubs: clubsData.clubs,
			seo: { ...seo, schemas: [JSON.stringify(applicationPageSchema)] },
		};
	});

export const Route = createFileRoute("/{-$locale}/_public/events/$id/apply")({
	loader: async ({ params, context }) => {
		if (!context.user) {
			// A disabled feature says so to everyone, before the login redirect.
			const flags = await getFeatureFlagsFn();
			if (!flags.EVENT_REGISTRATION) {
				return { kind: "disabled" as const };
			}
			throw redirect({
				href: `/login?redirectTo=${encodeURIComponent(`/events/${params.id}/apply`)}`,
				locale: context.locale,
			});
		}
		return await getApplyPageFn({ data: { id: params.id, locale: context.locale } });
	},
	head: ({ loaderData }) => {
		return loaderData?.seo ? buildSeoHead(loaderData.seo) : {};
	},
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: EventApplicationPage,
});

function EventApplicationPage() {
	const t = useExtracted();
	const page = Route.useLoaderData();
	const { user } = Route.useRouteContext();

	if (page.kind === "disabled") {
		return <ErrorPage title={t("This functionality is not available")} />;
	}
	if (page.kind === "event-not-found") {
		return <ErrorPage title={t("Event Not Found - RECONNED")} />;
	}
	if (page.kind === "load-failed" || !user) {
		return <ErrorPage title={t("Failed to load user data")} />;
	}
	if (page.kind === "closed") {
		return (
			<ErrorPage
				title={t("Registrations for this event are not open")}
				link={`/events/${page.eventId}`}
				linkText={t("Back to event")}
			/>
		);
	}

	const { event, existingRegistration, capacity, currentUserClubs } = page;

	return (
		<div className="container mx-auto max-w-[1200px] py-8">
			<h1 className="text-3xl font-bold mb-8">
				{existingRegistration ? t("Edit event application") : t("Apply to event")}: {event.name}
			</h1>
			<EventApplicationForm
				existingApplication={existingRegistration}
				event={event}
				user={user}
				currentUserClubs={currentUserClubs}
				capacity={capacity}
			/>
		</div>
	);
}
