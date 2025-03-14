"use server";

import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { z } from "zod";

// Define schema for club admin actions
const clubAdminActionSchema = z.object({
	clubId: z.string(),
	action: z.enum(["ban", "unban", "remove"]),
});

export const clubAdminAction = safeActionClient
	.schema(clubAdminActionSchema)
	.action(async ({ parsedInput }) => {
		const { clubId, action } = parsedInput;
		if (action === "ban") {
			await prisma.club.update({
				where: { id: clubId },
				data: { banned: true },
			});
		} else if (action === "unban") {
			await prisma.club.update({
				where: { id: clubId },
				data: { banned: false, banReason: null, banExpires: null },
			});
		} else if (action === "remove") {
			await prisma.club.delete({
				where: { id: clubId },
			});
		}
		return { success: true };
	});
