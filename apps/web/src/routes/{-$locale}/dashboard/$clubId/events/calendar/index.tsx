import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { addMonths, endOfMonth, parse as parseDateFns, startOfMonth, subMonths } from "date-fns";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { ErrorPage } from "@/components/error-page";
import { EventCalendar } from "@/components/event-calendar";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { serializable } from "@/routes/{-$locale}/dashboard/$clubId/-lib/serializable";

const getCalendarFn = createServerFn({ method: "GET" })
	.validator(z.object({ clubId: z.string(), month: z.string().optional() }))
	.handler(async ({ data }) => {
		const currentDate = data.month ? parseDateFns(data.month, "yyyy-MM", new Date()) : new Date();
		const { data: calendar, error } = await apiServer.GET("/api/events/calendar", {
			params: {
				query: {
					startDate: startOfMonth(subMonths(currentDate, 1)).toISOString(),
					endDate: endOfMonth(addMonths(currentDate, 1)).toISOString(),
					clubId: data.clubId,
				},
			},
		});
		return error || !calendar ? null : serializable(calendar.events);
	});

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/events/calendar/")({
	validateSearch: z.object({ month: z.coerce.string().optional() }),
	loaderDeps: ({ search }) => ({ month: search.month }),
	loader: async ({ params, deps }) => ({
		events: await getCalendarFn({ data: { clubId: params.clubId, month: deps.month } }),
	}),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: CalendarPage,
});

function CalendarPage() {
	const t = useExtracted();
	const { events } = Route.useLoaderData();

	if (!events) {
		return <ErrorPage title={t("Failed to load events")} />;
	}
	return <EventCalendar events={events} />;
}
