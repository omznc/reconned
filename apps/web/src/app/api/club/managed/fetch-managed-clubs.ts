import { Role } from "@generated/client";
import { prisma } from "@/lib/prisma";

export const fetchManagedClubs = async (userId: string) => {
	const ids = await prisma.clubMembership.findMany({
		where: {
			userId: userId,
			role: {
				in: [Role.CLUB_OWNER, Role.MANAGER],
			},
		},
		select: {
			clubId: true,
		},
	});
	return ids.map((club) => club.clubId) ?? [];
};
