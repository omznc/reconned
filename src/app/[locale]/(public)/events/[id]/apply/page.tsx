import { isAfter, isBefore } from "date-fns";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { WebPage, WithContext } from "schema-dts";
import { EventApplicationForm } from "@/app/[locale]/(public)/events/[id]/apply/_components/event-application.form";
import { ErrorPage } from "@/components/error-page";
import JsonLdScript from "@/components/json-ld-script";
import { redirect } from "@/i18n/navigation";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { FEATURE_FLAGS } from "@/lib/server-utils";

interface EventApplicationPageProps {
	params: Promise<{
		id: string;
	}>;
}

export default async function EventApplicationPage(props: EventApplicationPageProps) {
	const t = await getTranslations();
	if (!FEATURE_FLAGS.EVENT_REGISTRATION) {
		return <ErrorPage title={t("dashboard.club.events.attendenceTracking.unavailable")} />;
	}

	const [locale, user, params] = await Promise.all([getLocale(), isAuthenticated(), props.params]);
	if (!user) {
		return redirect({
			href: `/login?redirectTo=${env.NEXT_PUBLIC_BETTER_AUTH_URL}/events/${params.id}/apply`,
			locale,
		});
	}

	const conditionalPrivateWhere = user
		? {
				OR: [
					{
						isPrivate: false,
					},
					{
						club: {
							members: {
								some: {
									userId: user?.id,
								},
							},
						},
					},
				],
			}
		: {
				isPrivate: false,
			};

	const event = await prisma.event.findFirst({
		where: {
			OR: [
				{
					id: params.id,
				},
				{
					slug: params.id,
				},
			],
			...conditionalPrivateWhere,
		},
		include: {
			club: {
				select: {
					id: true,
				},
			},
			rules: true,
		},
	});

	if (!event) {
		return notFound();
	}

	const [currentUserClubs, existingApplication] = await Promise.all([
		prisma.club.findMany({
			where: {
				members: {
					some: {
						userId: user.id,
					},
				},
			},
		}),
		prisma.eventRegistration.findFirst({
			where: {
				eventId: event.id,
				createdById: user.id,
			},
			include: {
				invitedUsers: {
					select: {
						id: true,
						email: true,
						name: true,
						callsign: true,
						image: true,
					},
				},
				invitedUsersNotOnApp: {
					select: {
						eventId: true,
						id: true,
						email: true,
						name: true,
						createdAt: true,
						updatedAt: true,
						expiresAt: true,
						eventRegistrationId: true,
					},
				},
			},
		}),
	]);

	const canApplyToEvent =
		isAfter(new Date(), new Date(event.dateRegistrationsOpen)) &&
		isBefore(new Date(), new Date(event.dateRegistrationsClose));

	if (!canApplyToEvent) {
		return (
			<ErrorPage
				title={t("public.events.apply.registrationsClosed")}
				link={`/events/${event.id}`}
				linkText={t("public.events.apply.backToEvent")}
			/>
		);
	}

	const applicationPageSchema: WithContext<WebPage> = {
		"@context": "https://schema.org",
		"@type": "WebPage",
		"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/events/${event.slug ?? event.id}/apply`,
		name: `${existingApplication ? t("public.events.apply.editTitle") : t("public.events.apply.title")}: ${event.name}`,
		description: t("public.events.apply.metadata.description", { eventName: event.name }),
		url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/events/${event.slug ?? event.id}/apply`,
		mainEntity: {
			"@type": "SportsEvent",
			"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/events/${event.slug ?? event.id}`,
			name: event.name,
			sport: "Airsoft",
			startDate: event.dateStart.toISOString(),
			endDate: event.dateEnd.toISOString(),
			url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/events/${event.slug ?? event.id}`,
		},
		breadcrumb: {
			"@type": "BreadcrumbList",
			itemListElement: [
				{
					"@type": "ListItem",
					position: 1,
					name: "Home",
					item: env.NEXT_PUBLIC_BETTER_AUTH_URL,
				},
				{
					"@type": "ListItem",
					position: 2,
					name: "Events",
					item: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/events`,
				},
				{
					"@type": "ListItem",
					position: 3,
					name: event.name,
					item: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/events/${event.slug ?? event.id}`,
				},
				{
					"@type": "ListItem",
					position: 4,
					name: "Apply",
					item: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/events/${event.slug ?? event.id}/apply`,
				},
			],
		},
	};

	return (
		<div className="container mx-auto max-w-[1200px] py-8">
			<JsonLdScript data={applicationPageSchema} />
			<h1 className="text-3xl font-bold mb-8">
				{existingApplication ? t("public.events.apply.editTitle") : t("public.events.apply.title")}:{" "}
				{event.name}
			</h1>
			<EventApplicationForm
				existingApplication={existingApplication}
				event={event}
				user={user}
				currentUserClubs={currentUserClubs}
			/>
		</div>
	);
}

export async function generateMetadata(props: EventApplicationPageProps): Promise<Metadata> {
	const params = await props.params;
	const t = await getTranslations();

	const event = await prisma.event.findFirst({
		where: {
			OR: [
				{
					id: params.id,
				},
				{
					slug: params.id,
				},
			],
		},
		select: {
			id: true,
			slug: true,
			name: true,
			description: true,
		},
	});

	if (!event) {
		return {
			title: t("public.events.apply.eventNotFound"),
		};
	}

	const canonicalUrl = `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/events/${event.slug || event.id}/apply`;

	return {
		title: t("public.events.apply.applyToEvent", { eventName: event.name }),
		description: t("public.events.apply.applyToParticipate", { eventName: event.name }),
		alternates: {
			canonical: canonicalUrl,
		},
	};
}
