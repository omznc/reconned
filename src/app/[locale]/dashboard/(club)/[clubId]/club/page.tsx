import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ClubOverview } from "@/components/overviews/club-overview";

interface PageProps {
	params: Promise<{
		clubId: string;
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}
	const [userMembership, club] = await Promise.all([
		prisma.clubMembership.findFirst({
			where: {
				userId: user.id,
				clubId: params.clubId,
			},
		}),
		prisma.club.findUnique({
			where: {
				members: {
					some: {
						userId: user.id,
					},
				},
				id: params.clubId,
			},
			include: {
				_count: {
					select: {
						members: true,
					},
				},
				posts: true,
			},
		}),
	]);

	if (!club) {
		return notFound();
	}

	const isManager = user.managedClubs.includes(club.id);

	return (
		<ClubOverview
			club={club}
			isManager={isManager}
			isMember={true}
			currentUserMembership={userMembership}
		/>
	);
}
