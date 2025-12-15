import { addMonths, endOfMonth, parse as parseDateFns, startOfMonth, subMonths } from "date-fns";
import { EventCalendar } from "@/components/event-calendar";
import apiClient from "@/lib/api";

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/events/calendar">) {
	const params = await props.params;
	const { month } = await props.searchParams;

	const currentDate = month ? parseDateFns(month as string, "yyyy-MM", new Date()) : new Date();
	const startDate = startOfMonth(subMonths(currentDate, 1));
	const endDate = endOfMonth(addMonths(currentDate, 1));

	const { data, error } = await apiClient.GET("/api/events/calendar", {
		params: {
			query: {
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString(),
			},
		},
	});

	if (error || !data) {
		return <div>Failed to load events</div>;
	}

	// Filter events for the specific club
	const clubEvents = data.events.filter((event) => event.clubId === params.clubId);

	return <EventCalendar events={clubEvents} />;
}
