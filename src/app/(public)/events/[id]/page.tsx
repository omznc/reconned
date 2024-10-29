import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EventOverview } from "@/components/event-overview";

interface PageProps {
	params: Promise<{
		id: string;
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;

	const event = await prisma.event.findFirst({
		where: {
			id: params.id,
			isPrivate: false,
		},
		include: {
			_count: {
				select: {
					invites: true,
					registrations: true,
				},
			},
		},
	});

	if (!event) {
		return notFound();
	}

	return (
		<div className="flex flex-col size-full gap-8">
			<EventOverview event={event} />
		</div>
	);
}
export async function generateMetadata(props: PageProps) {
	const params = await props.params;

	const event = await prisma.event.findFirst({
		where: {
			id: params.id,
			isPrivate: false,
		},
		include: {
			_count: {
				select: {
					invites: true,
					registrations: true,
				},
			},
		},
	});

	if (!event) {
		return notFound();
	}

	return {
		title: `${event.name} - AirsoftBIH`,
		description: event.description.slice(0, 160),
		openGraph: {
			images: [
				{
					url: event.coverImage,
					alt: event.name,
				},
			],
		},
	};
}
