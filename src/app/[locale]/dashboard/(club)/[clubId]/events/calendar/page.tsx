import { addMonths, endOfMonth, parse as parseDateFns, startOfMonth, subMonths } from "date-fns";
import { EventCalendar } from "@/components/event-calendar";
import { prisma } from "@/lib/prisma";

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/events/calendar">) {
	const params = await props.params;
	const { month } = await props.searchParams;

	const currentDate = month ? parseDateFns(month as string, "yyyy-MM", new Date()) : new Date();
	const startDate = startOfMonth(subMonths(currentDate, 1));
	const endDate = endOfMonth(addMonths(currentDate, 1));

	const events = await prisma.event.findMany({
		where: {
			clubId: params.clubId,
			dateStart: {
				gte: startDate,
				lte: endDate,
			},
		},
		include: {
			club: {
				select: {
					name: true,
					verified: true,
				},
			},
		},
	});

	return <EventCalendar events={events} />;
}
