import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

interface PageProps {
	params: Promise<{ slug: string }>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;

	const event = await prisma.event.findUnique({
		where: {
			slug: params.slug,
		},
		select: {
			id: true,
		},
	});

	if (!event) {
		notFound();
	}

	redirect(`/events/${event.id}`);
}

export async function generateMetadata(props: PageProps) {
	const params = await props.params;

	const event = await prisma.event.findUnique({
		where: {
			slug: params.slug,
			isPrivate: false,
			club: {
				isPrivate: false,
			},
		},
		select: {
			name: true,
			description: true,
			dateStart: true,
			location: true,
			coverImage: true,
		},
	});

	if (!event) {
		return {};
	}

	return {
		title: event.name,
		description: event.description,
		openGraph: {
			title: event.name,
			description: event.description,
			type: "article",
			publishedTime: event.dateStart.toISOString(),
			location: event.location,
			images: [
				{
					url: event.coverImage,
					alt: event.name,
				},
			],
		},
	} as Metadata;
}
