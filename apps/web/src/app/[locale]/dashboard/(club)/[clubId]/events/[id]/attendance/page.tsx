import { getExtracted } from "next-intl/server";
import { AttendanceTracker } from "@/app/[locale]/dashboard/(club)/[clubId]/events/[id]/attendance/_components/attendance-tracker";
import { ErrorPage } from "@/components/error-page";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/events/[id]/attendance">) {
	const t = await getExtracted();
	const isEnabled = await isFeatureEnabled("EVENT_REGISTRATION");

	if (!isEnabled) {
		return <ErrorPage title={t("This functionality is not available")} />;
	}

	const params = await props.params;
	const user = await isAuthenticated();

	if (!user) {
		return <ErrorPage title={t("You have no access to this page")} />;
	}

	const { data: membershipData } = await apiServer.GET("/api/clubs/{id}/membership", {
		params: { path: { id: params.clubId } },
	});

	const role = membershipData?.membership?.role;
	const isManager = role === "MANAGER" || role === "CLUB_OWNER" || user.role === "admin";

	if (!isManager) {
		return <ErrorPage title={t("You have no access to this page")} />;
	}

	// Fetch event from backend
	const { data: eventData, error: eventError } = await apiServer.GET("/api/events/{id}", {
		params: { path: { id: params.id } },
	});

	if (eventError || !eventData) {
		return <ErrorPage title={t("Event Not Found - RECONNED")} />;
	}

	const { event } = eventData;

	// Verify event belongs to this club
	if (event.clubId !== params.clubId) {
		return <ErrorPage title={t("Event Not Found - RECONNED")} />;
	}

	// Fetch event registrations with details
	const { data: registrationsData, error: registrationsError } = await apiServer.GET(
		"/api/events/{id}/registrations",
		{
			params: { path: { id: params.id } },
		},
	);

	if (registrationsError || !registrationsData) {
		return <ErrorPage title={t("Event Not Found - RECONNED")} />;
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

	// Attendance stays reachable after the event ends. Organisers routinely finish marking the
	// roster once everyone has gone home, and the API allows it, so closing the page at dateEnd
	// only meant the record could never be corrected.

	// Combine event with registrations for the attendance tracker
	const eventWithRegistrations = {
		...event,
		eventRegistration: registrationsData.registrations,
	};

	return <AttendanceTracker event={eventWithRegistrations} />;
}
