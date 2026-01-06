import { addMonths, endOfMonth, parse as parseDateFns, startOfMonth, subMonths } from "date-fns";
import { getExtracted } from "next-intl/server";
import { ErrorPage } from "@/components/error-page";
import { EventCalendar } from "@/components/event-calendar";
import apiServer from "@/lib/api/api";

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/events/calendar">) {
	const params = await props.params;
	const { month } = await props.searchParams;
	const t = await getExtracted();

	const currentDate = month ? parseDateFns(month as string, "yyyy-MM", new Date()) : new Date();
	const startDate = startOfMonth(subMonths(currentDate, 1));
	const endDate = endOfMonth(addMonths(currentDate, 1));

	const { data, error } = await apiServer.GET("/api/events/calendar", {
		params: {
			query: {
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString(),
				clubId: params.clubId,
			},
		},
	});

	if (error || !data) {
		return <ErrorPage title={t("Failed to load events")} />;
	}

	return <EventCalendar events={data.events} />;
}
