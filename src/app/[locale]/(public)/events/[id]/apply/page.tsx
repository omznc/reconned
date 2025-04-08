import { EventApplicationForm } from "@/app/[locale]/(public)/events/[id]/apply/_components/event-application.form";
import { ErrorPage } from "@/components/error-page";
import { redirect } from "@/i18n/navigation";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { FEATURE_FLAGS } from "@/lib/server-utils";
import { isAfter, isBefore } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

interface EventApplicationPageProps {
	params: Promise<{
		id: string;
	}>;
}

export default async function EventApplicationPage(
	props: EventApplicationPageProps,
) {
	const t = await getTranslations("dashboard.club.events");
	if (!FEATURE_FLAGS.EVENT_REGISTRATION) {
		return <ErrorPage title={t("attendenceTracking.unavailable")} />;
	}

	const [locale, user, params] = await Promise.all([
		getLocale(),
		isAuthenticated(),
		props.params,
	]);
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
				title="Registracije za ovaj susret nisu otvorene"
				link={`/events/${event.id}`}
				linkText="Povratak na susret"
			/>
		);
	}

	return (
		<div className="container mx-auto max-w-[1200px] py-8">
			<h1 className="text-3xl font-bold mb-8">
				{existingApplication
					? "Promjena prijave na susret: "
					: "Prijava na susret: "}
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
