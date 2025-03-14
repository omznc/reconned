import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ClubOverview } from "@/components/overviews/club-overview";
import { isAuthenticated } from "@/lib/auth";
import type { Metadata } from "next";
import { env } from "@/lib/env";
import NotFoundTemporary from "@/app/not-found";

interface PageProps {
	params: Promise<{
		id: string;
		locale: string;
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
			members: {
				include: {
					user: {
						select: {
							id: true,
							name: true,
							callsign: true,
							slug: true,
							image: true,
							role: true,
						},
					},
				},
			},
		},
	});

	if (!club) {
		// TODO https://github.com/vercel/next.js/issues/63388
		// notFound();
		return <NotFoundTemporary />;
	}

	return (
		<div className="flex flex-col size-full gap-8 max-w-[1200px] pb-8 px-4">
			<ClubOverview
				club={club}
				isManager={user?.managedClubs.includes(club.id)}
			/>
		</div>
	);
}

// TODO: Localize this
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
