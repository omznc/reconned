import { EventOverview } from "@/components/event-overview";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

interface PageProps {
	params: Promise<{
		clubId: string;
		id: string;
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const event = await prisma.event.findFirst({
		where: {
			id: params.id,
			club: {
				members: {
					some: {
						userId: user.id,
					},
				},
			},
		},
		include: {
			_count: {
				select: {
					eventRegistration: true,
				},
			},
		},
	});

	if (!event) {
		return notFound();
	}

	return (
		<div className="space-y-4 max-w-3xl w-full">
			<div>
				<h3 className="text-lg font-semibold">Susret</h3>
			</div>
			<EventOverview event={event} clubId={params.clubId} />
		</div>
	);
}
