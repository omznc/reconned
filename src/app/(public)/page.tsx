import { EventCalendar } from "@/components/event-calendar";
import { prisma } from "@/lib/prisma";

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
			<div className="relative h-[calc(100dvh-72px-2rem)] w-full">
				<EventCalendar events={events} />
			</div>
		</div>
	);
}
