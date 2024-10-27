import { EventCalendar } from "@/components/event-calendar";
import { prisma } from "@/lib/prisma";

interface PageProps {
	params: Promise<{
		clubId: string;
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;
	const events = await prisma.event.findMany({
		where: {
			clubId: params.clubId,
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
		<div className="space-y-4 max-w-3xl">
			<EventCalendar events={events} />
		</div>
	);
}
