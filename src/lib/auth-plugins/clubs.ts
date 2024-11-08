import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";

export const clubs = () =>
	({
		id: "clubs",
		schema: {
			user: {
				fields: {
					managedClubs: {
						type: "string[]",
						input: false,
					},
				},
			},
		},
		endpoints: {
			getManagedClubs: createAuthEndpoint(
				"managed-clubs",
				{
					method: "GET",
					requireHeaders: true,
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const session = ctx.context.session;

					if (!session) {
						return [];
					}

					const managedClubs = await prisma.clubMembership.findMany({
						where: {
							userId: session.user.id,
							role: {
								in: [Role.CLUB_OWNER, Role.MANAGER],
							},
						},
						select: {
							clubId: true,
						},
					});

					return managedClubs.map((club) => club.clubId) ?? [];
				},
			),
		},
	}) satisfies BetterAuthPlugin;
