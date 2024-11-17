import { EventOverview } from "@/components/event-overview";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

interface PageProps {
	params: Promise<{
		id: string;
	}>;
}

export default async function Page(props: PageProps) {
	const user = await isAuthenticated();
	const params = await props.params;

	const conditionalPrivateWhere = user
		? {
				OR: [
					{
						isPrivate: false,
					},
					{
						club: {
							members: {
								some: {
									userId: user?.id,
								},
							},
						},
					},
				],
			}
		: {
				isPrivate: false,
			};

	const event = await prisma.event.findFirst({
		where: {
			id: params.id,
			...conditionalPrivateWhere,
		},
		include: {
			_count: {
				select: {
					eventRegistration: true,
				},
			},
			rules: true,
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
	const user = await isAuthenticated();

	const event = await prisma.event.findFirst({
		where: {
			id: params.id,
			OR: [
				{
					isPrivate: false,
				},
				{
					club: {
						members: {
							some: {
								userId: user?.id,
							},
						},
					},
				},
			],
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

	return {
		title: `${event.name} - AirsoftBIH`,
		description: event.description.slice(0, 160),
		openGraph: {
			images: [
				{
					url: event.coverImage as string,
					alt: event.name,
				},
			],
		},
	};
}
