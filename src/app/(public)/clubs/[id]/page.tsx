import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ClubOverview } from "@/components/overviews/club-overview";
import { isAuthenticated } from "@/lib/auth";

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
					clubId: params.id,
				},
			})
		: false;

	const club = await prisma.club.findFirst({
		where: {
			id: params.id,
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
		return notFound();
	}

	return (
		<div className="flex flex-col size-full gap-8 max-w-[1200px] py-8">
			<ClubOverview
				club={club}
				isManager={user?.managedClubs.includes(club.id)}
			/>
		</div>
	);
}

export async function generateMetadata(props: PageProps) {
	const params = await props.params;

	const club = await prisma.club.findFirst({
		where: {
			id: params.id,
			isPrivate: false,
		},
	});

	if (!club) {
		return notFound();
	}

	return {
		title: `${club.name} - AirsoftBIH`,
		description: club.description?.slice(0, 160) ?? "Airsoft klub",
		openGraph: {
			images: [
				{
					url: club.logo,
					width: 1200,
					height: 630,
					alt: club.name,
				},
			],
		},
	};
}
