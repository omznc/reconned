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
	searchParams: Promise<{
		month?: string;
	}>;
}

export default async function Home({ searchParams }: PageProps) {
	const { month } = await searchParams;

	const currentDate = month
		? parseDateFns(month, "yyyy-MM", new Date())
		: new Date();
	const startDate = startOfMonth(subMonths(currentDate, 1));
	const endDate = endOfMonth(addMonths(currentDate, 1));

	const events = await prisma.event.findMany({
		where: {
			isPrivate: false,
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

	return (
		<div className="flex flex-col size-full gap-8">
			<EventCalendar events={events} />
		</div>
	);
}
