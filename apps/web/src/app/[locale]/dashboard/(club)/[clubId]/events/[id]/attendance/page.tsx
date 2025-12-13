import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { AttendanceTracker } from "@/app/[locale]/dashboard/(club)/[clubId]/events/[id]/attendance/_components/attendance-tracker";
import { ErrorPage } from "@/components/error-page";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FEATURE_FLAGS } from "@/lib/server-utils";

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/events/[id]/attendance">) {
	const t = await getExtracted();

	if (!FEATURE_FLAGS.EVENT_REGISTRATION) {
		return <ErrorPage title={t("This functionality is not available")} />;
	}

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
				title={t("Applications are still open")}
				link={`/dashboard/${params.clubId}/events/${params.id}`}
				linkText={t("Back to the event")}
			/>
		);
	}

	if (new Date() > event.dateEnd) {
		return (
			<ErrorPage
				title={t("The event is over")}
				link={`/dashboard/${params.clubId}/events/${params.id}`}
				linkText={t("Back to the event")}
			/>
		);
	}

	return <AttendanceTracker event={event} />;
}
