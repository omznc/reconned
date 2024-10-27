import { prisma } from "@/lib/prisma";
import { EventCalendar } from "@/components/event-calendar";

export default async function Home() {
	const events = await prisma.event.findMany({
		where: {
			isPrivate: false,
		},
		include: {
			club: {
				select: {
					name: true,
				},
			},
		},
		take: 100,
	});

	return (
		<div className="flex flex-col size-full gap-8">
			<EventCalendar events={events} />
		</div>
	);
}
