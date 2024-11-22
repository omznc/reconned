import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

interface PageProps {
	params: Promise<{ slug: string }>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;

	const user = await prisma.user.findUnique({
		where: {
			slug: params.slug,
		},
		select: {
			id: true,
		},
	});

	if (!user) {
		notFound();
	}

	redirect(`/users/${user.id}`);
}

export async function generateMetadata(props: PageProps) {
	const params = await props.params;

	const user = await prisma.user.findUnique({
		where: {
			slug: params.slug,
			isPrivate: false,
		},
		select: {
			name: true,
			bio: true,
			createdAt: true,
			location: true,
			image: true,
		},
	});

	if (!user) {
		return {};
	}

	return {
		title: user.name,
		description: user.bio,
		date: user.createdAt,
		openGraph: {
			title: user.name,
			description: user.bio,
			type: "profile",
			location: user.location,
			images: [
				{
					url: user.image,
					alt: user.name,
				},
			],
		},
	} as Metadata;
}
