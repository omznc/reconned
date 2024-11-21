import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AttendanceTracker } from "./_components/attendance-tracker";
import { ErrorPage } from "@/components/error-page";

interface PageProps {
	params: Promise<{
		clubId: string;
		id: string;
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;
	const user = await isAuthenticated();

	if (!user?.managedClubs.some((club) => club === params.clubId)) {
		return notFound();
	}

	const event = await prisma.event.findFirst({
		where: {
			id: params.id,
			clubId: params.clubId,
		},
		include: {
			eventRegistration: {
				include: {
					invitedUsers: true,
					invitedUsersNotOnApp: true,
					createdBy: true,
				},
			},
		},
	});

	if (!event) {
		return notFound();
	}

	if (new Date() < event.dateRegistrationsClose) {
		return (
			<ErrorPage
				title="Registracije još nisu zatvorene"
				link={`/dashboard/${params.clubId}/events/${params.id}`}
				linkText="Povratak na susret"
			/>
		);
	}

	if (new Date() > event.dateEnd) {
		return (
			<ErrorPage
				title="Susret je završen"
				link={`/dashboard/${params.clubId}/events/${params.id}`}
				linkText="Povratak na susret"
			/>
		);
	}

	return <AttendanceTracker event={event} />;
}
