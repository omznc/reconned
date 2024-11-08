import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
	const user = await isAuthenticated();

	if (!user) {
		return NextResponse.json([]);
	}

	const managedClubs = await fetchManagedClubs(user.id);
	return NextResponse.json(managedClubs);
}

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
