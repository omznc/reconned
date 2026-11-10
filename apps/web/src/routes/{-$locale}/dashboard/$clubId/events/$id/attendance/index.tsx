import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { ErrorPage, NoAccessPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { serializable } from "@/routes/{-$locale}/dashboard/$clubId/-lib/serializable";
import { AttendanceTracker } from "@/routes/{-$locale}/dashboard/$clubId/events/$id/attendance/-components/attendance-tracker";

const getAttendanceFn = createServerFn({ method: "GET" })
	.validator(z.object({ clubId: z.string(), id: z.string() }))
	.handler(async ({ data }) => {
		if (!(await isFeatureEnabled("EVENT_REGISTRATION"))) {
			return { kind: "unavailable" as const };
		}
		const path = { id: data.id };
		const [eventResp, registrationsResp] = await Promise.all([
			apiServer.GET("/api/events/{id}", { params: { path } }),
			apiServer.GET("/api/events/{id}/registrations", { params: { path } }),
		]);
		const event = eventResp.data?.event;
		const registrations = registrationsResp.data?.registrations;
		if (eventResp.error || !event || event.clubId !== data.clubId || registrationsResp.error || !registrations) {
			return { kind: "not-found" as const };
		}
		if (new Date() < new Date(event.dateRegistrationsClose)) {
			return { kind: "registrations-open" as const };
		}
		// Attendance stays reachable after the event ends: organisers finish marking the roster later.
		return serializable({ kind: "ok" as const, event: { ...event, eventRegistration: registrations } });
	});

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/events/$id/attendance/")({
	loader: async ({ params, context }) => {
		if (!context.access.isManager) {
			return { kind: "forbidden" as const };
		}
		const page = await getAttendanceFn({ data: { clubId: params.clubId, id: params.id } });
		if (page.kind === "not-found") {
			throw notFound();
		}
		return page;
	},
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: AttendancePage,
});

function AttendancePage() {
	const t = useExtracted();
	const { clubId, id } = Route.useParams();
	const page = Route.useLoaderData();

	if (page.kind === "forbidden") {
		return <NoAccessPage />;
	}
	if (page.kind === "unavailable") {
		return <ErrorPage title={t("This functionality is not available")} />;
	}
	if (page.kind === "registrations-open") {
		return (
			<ErrorPage
				title={t("Applications are still open")}
				link={`/dashboard/${clubId}/events/${id}`}
				linkText={t("Back to the event")}
			/>
		);
	}
	return <AttendanceTracker event={page.event} />;
}
