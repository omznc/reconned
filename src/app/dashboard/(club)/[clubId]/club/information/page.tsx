import { ClubInfoForm } from "@/app/dashboard/(club)/[clubId]/club/information/_components/club-info.form";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { notFound } from "next/navigation";

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

	const club = await prisma.club.findUnique({
		where: {
			members: {
				some: {
					userId: user.id,
					role: {
						in: [Role.CLUB_OWNER, Role.MANAGER],
					},
				},
			},
			id: params.clubId,
		},
		include: {
			members: {
				select: {
					userId: true,
					role: true,
				},
				where: {
					userId: user.id,
				},
			},
		},
	});

	if (!club) {
		return notFound();
	}

	const isClubOwner = club.members[0].role === Role.CLUB_OWNER;

	return <ClubInfoForm club={club} isClubOwner={isClubOwner} />;
}
