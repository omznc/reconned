import { EventApplicationForm } from "@/app/(public)/events/[id]/apply/_components/event-application-form";
import { ErrorPage } from "@/components/error-page";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { isAfter, isBefore } from "date-fns";
import { notFound, redirect } from "next/navigation";

interface EventApplicationPageProps {
	params: Promise<{
		id: string;
	}>;
}

export default async function EventApplicationPage(
	props: EventApplicationPageProps,
) {
	const user = await isAuthenticated();
	const params = await props.params;
	if (!user) {
		return redirect(
			`/login?redirectTo=${encodeURIComponent(`${env.NEXT_PUBLIC_BETTER_AUTH_URL}/events/${params.id}/apply`)}`,
		);
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

	const event = await prisma.event.findUnique({
		where: {
			id: params.id,
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
		<div className="container py-8 max-w-2xl mx-auto">
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
