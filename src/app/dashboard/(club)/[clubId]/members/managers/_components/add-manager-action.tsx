"use server";

import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { promoteToManagerSchema } from "@/app/dashboard/(club)/[clubId]/members/managers/_components/add-manager-schema";

export const promoteToManager = safeActionClient
	.schema(promoteToManagerSchema)
	.action(async ({ parsedInput, ctx }) => {
		try {
			const club = await prisma.club.findUnique({
				where: {
					id: parsedInput.clubId,
					members: {
						some: {
							userId: ctx.user.id,
							role: {
								in: [Role.CLUB_OWNER],
							},
						},
					},
				},
				select: {
					id: true,
					name: true,
				},
			});

			if (!club) {
				throw new Error("Nemate dozvolu za ovu akciju ili klub nije pronađen.");
			}

			const targetMembership = await prisma.clubMembership.findFirst({
				where: {
					id: parsedInput.memberId,
					clubId: club.id,
					role: Role.USER,
				},
				include: {
					user: {
						select: {
							name: true,
							email: true,
						},
					},
				},
			});

			if (!targetMembership) {
				throw new Error("Član nije pronađen ili je već menadžer.");
			}

			const updatedMembership = await prisma.clubMembership.update({
				where: {
					id: parsedInput.memberId,
					clubId: club.id,
				},
				data: {
					role: Role.MANAGER,
				},
				include: {
					user: {
						select: {
							name: true,
							email: true,
						},
					},
				},
			});

			revalidatePath(`/dashboard/${club.id}/members`);

			return {
				success: true,
				data: {
					membership: updatedMembership,
				},
			};
		} catch (error) {
			if (error instanceof Error) {
				return {
					success: false,
					error: error.message,
				};
			}
			return {
				success: false,
				error: "Došlo je do neočekivane greške.",
			};
		}
	});
