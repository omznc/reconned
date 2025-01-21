import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ClubOverview } from "@/components/overviews/club-overview";
import { isAuthenticated } from "@/lib/auth";
import type { Metadata } from "next";
import { env } from "@/lib/env";

interface PageProps {
	params: Promise<{
		id: string;
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;
	const user = await isAuthenticated();
	const isMemberOfClub = user
		? await prisma.clubMembership.findFirst({
				where: {
					userId: user?.id,
					club: {
						OR: [{ id: params.id }, { slug: params.id }],
					},
				},
			})
		: false;

	const club = await prisma.club.findFirst({
		where: {
			OR: [{ id: params.id }, { slug: params.id }],
			isPrivate: false,
		},
		include: {
			_count: {
				select: {
					members: true,
				},
			},
			posts: {
				orderBy: {
					createdAt: "desc",
				},
				...(isMemberOfClub ? {} : { where: { isPublic: true } }),
			},
		},
	});

	if (!club) {
		notFound();
	}

	return (
		<div className="flex flex-col size-full gap-8 max-w-[1200px] py-8 px-4">
			<ClubOverview
				club={club}
				isManager={user?.managedClubs.includes(club.id)}
			/>
		</div>
	);
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
	const params = await props.params;

	const club = await prisma.club.findFirst({
		where: {
			OR: [{ id: params.id }, { slug: params.id }],
			isPrivate: false,
		},
	});

	if (!club) {
		notFound();
	}

	const ogUrl = new URL(`${env.NEXT_PUBLIC_BETTER_AUTH_URL}/api/og/club`);
	ogUrl.searchParams.set("name", club.name);
	if (club.description) {
		ogUrl.searchParams.set("description", club.description);
	}
	if (club.logo) {
		ogUrl.searchParams.set("logo", club.logo);
	}

	return {
		title: `${club.name} - RECONNED`,
		description: club.description?.slice(0, 160) ?? "Airsoft klub",
		openGraph: {
			images: [
				{
					url: ogUrl.toString(),
					width: 1200,
					height: 630,
					alt: club.name,
				},
			],
		},
		metadataBase: env.NEXT_PUBLIC_BETTER_AUTH_URL
			? new URL(env.NEXT_PUBLIC_BETTER_AUTH_URL)
			: undefined,
	};
}

export async function generateStaticParams() {
	const clubs = await prisma.club.findMany({
		where: {
			isPrivate: false,
		},
		select: {
			id: true,
		},
	});

	return clubs.map((club) => ({
		id: club.id,
	}));
}
