"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";

// Define schema for club admin actions
const clubAdminActionSchema = z.object({
	clubId: z.string(),
	action: z.enum(["ban", "unban", "remove"]),
});

export const clubAdminAction = safeActionClient
	.inputSchema(clubAdminActionSchema)
	.action(async ({ parsedInput, ctx }) => {
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
