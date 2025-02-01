import { prisma } from "@/lib/prisma";

export async function getUser(userId: string) {
	if (!userId) return null;

	return await prisma.user.findUnique({
		where: { id: userId },
		include: {
			clubMembership: {
				include: {
					club: {
						select: {
							name: true,
						},
					},
				},
			},
		},
	});
}
