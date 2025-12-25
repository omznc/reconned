import { isAfter, isBefore } from "date-fns";
import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { CollectionPage, WithContext } from "schema-dts";
import { EventApplicationForm } from "@/app/[locale]/(public)/events/[id]/apply/_components/event-application.form";
import { ErrorPage } from "@/components/error-page";
import JsonLdScript from "@/components/json-ld-script";
import { redirect } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { FEATURE_FLAGS } from "@/lib/server-utils";
import { constructCanonicalUrl, generateHreflangAlternatesForSluggableEntity } from "@/lib/utils";

export default async function EventApplicationPage(props: PageProps<"/[locale]/events/[id]/apply">) {
	const t = await getExtracted();
	if (!FEATURE_FLAGS.EVENT_REGISTRATION) {
		return <ErrorPage title={t("This functionality is not available")} />;
	}

	const [user, params] = await Promise.all([isAuthenticated(), props.params]);
	const locale = params.locale;
	if (!user) {
		return redirect({
			href: `/login?redirectTo=${env.NEXT_PUBLIC_WEB_URL}/events/${params.id}/apply`,
			locale,
		});
	}

	// Fetch event application data from backend
	const { data: applyData, error: applyError } = await apiServer.GET("/api/events/{id}/apply-data", {
		params: { path: { id: params.id } },
	});

	if (applyError || !applyData) {
		return <ErrorPage title={t("Event Not Found - RECONNED")} />;
	}

	const { event, existingRegistration } = applyData;

	// Fetch user's clubs from backend
	const { data: clubsData, error: clubsError } = await apiServer.GET("/api/users/me/clubs", {});

	if (clubsError || !clubsData) {
		return <ErrorPage title={t("Failed to load user data")} />;
	}

	const currentUserClubs = clubsData.clubs;

	const canApplyToEvent =
		isAfter(new Date(), new Date(event.dateRegistrationsOpen)) &&
		isBefore(new Date(), new Date(event.dateRegistrationsClose));

	if (!canApplyToEvent) {
		return (
			<ErrorPage
				title={t("Registrations for this event are not open")}
				link={`/events/${event.id}`}
				linkText={t("Back to event")}
			/>
		);
	}

	const applicationPageSchema: WithContext<CollectionPage> = {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		"@id": `${env.NEXT_PUBLIC_WEB_URL}/events/${event.slug || event.id}/apply`,
		name: `${existingRegistration ? t("Edit event application") : t("Apply to event")}: ${event.name}`,
		description: t("Applying to {eventName}", { eventName: event.name }),
		url: `${env.NEXT_PUBLIC_WEB_URL}/events/${event.slug || event.id}/apply`,
		mainEntity: {
			"@type": "SportsEvent",
			"@id": `${env.NEXT_PUBLIC_WEB_URL}/events/${event.slug || event.id}`,
			name: event.name,
			sport: "Airsoft",
			startDate: event.dateStart,
			endDate: event.dateEnd,
			url: `${env.NEXT_PUBLIC_WEB_URL}/events/${event.slug || event.id}`,
		},
		breadcrumb: {
			"@type": "BreadcrumbList",
			itemListElement: [
				{
					"@type": "ListItem",
					position: 1,
					name: "Home",
					item: env.NEXT_PUBLIC_WEB_URL,
				},
				{
					"@type": "ListItem",
					position: 2,
					name: "Events",
					item: `${env.NEXT_PUBLIC_WEB_URL}/events`,
				},
				{
					"@type": "ListItem",
					position: 3,
					name: event.name,
					item: `${env.NEXT_PUBLIC_WEB_URL}/events/${event.slug || event.id}`,
				},
				{
					"@type": "ListItem",
					position: 4,
					name: "Apply",
					item: `${env.NEXT_PUBLIC_WEB_URL}/events/${event.slug || event.id}/apply`,
				},
			],
		},
	};

	return (
		<div className="container mx-auto max-w-[1200px] py-8">
			<JsonLdScript data={applicationPageSchema} />
			<h1 className="text-3xl font-bold mb-8">
				{existingRegistration ? t("Edit event application") : t("Apply to event")}: {event.name}
			</h1>
			<EventApplicationForm
				existingApplication={existingRegistration}
				event={event}
				user={user}
				currentUserClubs={currentUserClubs}
			/>
		</div>
	);
}

export async function generateMetadata(props: PageProps<"/[locale]/events/[id]/apply">): Promise<Metadata> {
	const [params, locale] = await Promise.all([props.params, getLocale()]);
	const t = await getExtracted();

	const { data: eventData } = await apiServer.GET("/api/events/{id}", {
		params: { path: { id: params.id } },
	});

	if (!eventData) {
		return {
			title: t("Event Not Found - RECONNED"),
		};
	}

	const event = eventData.event;
	const pathPrefix = "/events";
	const slugOrId = event.slug || event.id;
	const canonicalUrl = constructCanonicalUrl(
		env.NEXT_PUBLIC_WEB_URL || "",
		`${pathPrefix}/${slugOrId}/apply`,
		locale,
	);

	return {
		title: t("Apply to {eventName} - RECONNED", { eventName: event.name }),
		description: t("Apply to participate in {eventName}", { eventName: event.name }),
		alternates: {
			canonical: canonicalUrl,
			languages: generateHreflangAlternatesForSluggableEntity(
				env.NEXT_PUBLIC_WEB_URL || "",
				pathPrefix,
				event.id,
				locale,
				event.slug || undefined,
			),
		},
	};
}
