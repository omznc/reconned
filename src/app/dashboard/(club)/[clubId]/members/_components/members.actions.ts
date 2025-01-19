"use server";

import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { removeMemberSchema } from "./members.schema";
import { revalidatePath } from "next/cache";

export const removeMember = safeActionClient
	.schema(removeMemberSchema)
	.action(async ({ parsedInput, ctx }) => {
		try {
			const membership = await prisma.clubMembership.findFirst({
				where: {
					id: parsedInput.memberId,
					clubId: parsedInput.clubId,
					role: {
						not: "CLUB_OWNER",
					},
				},
				include: {
					user: {
						select: {
							name: true,
						},
					},
				},
			});

			if (!membership) {
				throw new Error("Član nije pronađen ili je vlasnik kluba.");
			}

			await prisma.clubMembership.delete({
				where: {
					id: parsedInput.memberId,
					clubId: parsedInput.clubId,
				},
			});

			revalidatePath(`/dashboard/${parsedInput.clubId}/members`);

			return {
				success: true,
				data: {
					membership,
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
