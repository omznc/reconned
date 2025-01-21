import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ErrorPage } from "@/components/error-page";
import { AttendanceTracker } from "@/app/dashboard/(club)/[clubId]/events/[id]/attendance/_components/attendance-tracker";
import { FEATURE_FLAGS } from "@/lib/server-utils";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

interface PageProps {
	params: Promise<{
		clubId: string;
		id: string;
	}>;
}

export default async function Page(props: PageProps) {
	const t = await getTranslations("dashboard.club.events");

	if (!FEATURE_FLAGS.EVENT_REGISTRATION) {
		return <ErrorPage title={t('unavailable')} />;
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
				title={t("registrationNotClosed")}
				link={`/dashboard/${params.clubId}/events/${params.id}`}
				linkText={t("backToEvent")}
			/>
		);
	}

	if (new Date() > event.dateEnd) {
		return (
			<ErrorPage
				title={t("eventEnded")}
				link={`/dashboard/${params.clubId}/events/${params.id}`}
				linkText={t(" backToEvent")}
			/>
		);
	}

	return <AttendanceTracker event={event} />;
}
