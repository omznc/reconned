import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

interface PageProps {
	params: Promise<{ slug: string }>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;

	const club = await prisma.club.findUnique({
		where: {
			slug: params.slug,
		},
		select: {
			id: true,
		},
	});

	if (!club) {
		notFound();
	}

	redirect(`/clubs/${club.id}`);
}

export async function generateMetadata(props: PageProps) {
	const params = await props.params;

	const club = await prisma.club.findUnique({
		where: {
			slug: params.slug,
			isPrivate: false,
		},
		select: {
			name: true,
			description: true,
			createdAt: true,
			location: true,
			logo: true,
		},
	});

	if (!club) {
		return {};
	}

	return {
		title: club.name,
		description: club.description,
		date: club.createdAt,
		openGraph: {
			title: club.name,
			description: club.description,
			type: "organization",
			location: club.location,
			images: [
				{
					url: club.logo,
					alt: club.name,
				},
			],
		},
	} as Metadata;
}
