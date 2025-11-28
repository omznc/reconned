import { Role } from "@generated/client";
import { prisma } from "@/lib/prisma";

export const getManagedClubsWithNames = async (userId: string) => {
	const clubs = await prisma.clubMembership.findMany({
		where: {
			userId: userId,
			role: {
				in: [Role.CLUB_OWNER, Role.MANAGER],
			},
		},
		select: {
			clubId: true,
			club: {
				select: {
					name: true,
				},
			},
		},
	});

	return clubs.map((club) => ({
		id: club.clubId,
		name: club.club.name,
	}));
};
