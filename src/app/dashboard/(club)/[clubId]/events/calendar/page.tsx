import { EventCalendar } from "@/components/event-calendar";
import { prisma } from "@/lib/prisma";
import {
	startOfMonth,
	endOfMonth,
	subMonths,
	addMonths,
	parse as parseDateFns,
} from "date-fns";

interface PageProps {
	params: Promise<{
		clubId: string;
	}>;
	searchParams: Promise<{
		month?: string;
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;
	const { month } = await props.searchParams;

	const currentDate = month
		? parseDateFns(month, "yyyy-MM", new Date())
		: new Date();
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
				},
			},
		},
	});

	return <EventCalendar events={events} />;
}
