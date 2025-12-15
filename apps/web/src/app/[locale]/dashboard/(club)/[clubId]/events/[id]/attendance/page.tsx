import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { AttendanceTracker } from "@/app/[locale]/dashboard/(club)/[clubId]/events/[id]/attendance/_components/attendance-tracker";
import { ErrorPage } from "@/components/error-page";
import apiClient from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
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

	// Fetch event from backend
	const { data: eventData, error: eventError } = await apiClient.GET("/api/events/{id}", {
		params: { path: { id: params.id } },
	});

	if (eventError || !eventData) {
		return notFound();
	}

	const { event } = eventData;

	// Verify event belongs to this club
	if (event.clubId !== params.clubId) {
		return notFound();
	}

	// Fetch event registrations with details
	const { data: registrationsData, error: registrationsError } = await apiClient.GET(
		"/api/events/{id}/registrations",
		{
			params: { path: { id: params.id } },
		},
	);

	if (registrationsError || !registrationsData) {
		return notFound();
	}

	if (new Date() < new Date(event.dateRegistrationsClose)) {
		return (
			<ErrorPage
				title={t("Applications are still open")}
				link={`/dashboard/${params.clubId}/events/${params.id}`}
				linkText={t("Back to the event")}
			/>
		);
	}

	if (new Date() > new Date(event.dateEnd)) {
		return (
			<ErrorPage
				title={t("The event is over")}
				link={`/dashboard/${params.clubId}/events/${params.id}`}
				linkText={t("Back to the event")}
			/>
		);
	}

	// Combine event with registrations for the attendance tracker
	const eventWithRegistrations = {
		...event,
		eventRegistration: registrationsData.registrations,
	};

	return <AttendanceTracker event={eventWithRegistrations} />;
}
