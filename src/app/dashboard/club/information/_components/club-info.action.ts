"use server";

import { clubInfoSchema } from "@/app/dashboard/club/information/_components/club-info.schema";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";

export const saveClubInformation = safeActionClient
	.schema(clubInfoSchema)
	.action(async ({ parsedInput, ctx }) => {
		const isManager = await prisma.clubMembership.findFirst({
			where: {
				userId: ctx.user.id,
				role: {
					in: ["CLUB_OWNER", "MANAGER"],
				},
			},
		});

		if (!isManager) {
			throw new Error("You are not authorized to perform this action.");
		}

		const club = await prisma.club.update({
			where: {
				id: isManager.clubId,
			},
			data: {
				name: parsedInput.name,
				location: parsedInput.location,
				description: parsedInput.description,
				dateFounded: parsedInput.dateFounded,
				isAllied: parsedInput.isAllied,
				isPrivate: parsedInput.isPrivate,
				logo: parsedInput.logo,
				contactPhone: parsedInput.contactPhone,
				contactEmail: parsedInput.contactEmail,
			},
		});

		revalidatePath(`/dashboard/club/information?club=${club.id}`);
	});
