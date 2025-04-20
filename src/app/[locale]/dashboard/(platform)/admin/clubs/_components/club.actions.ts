"use server";

import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { z } from "zod";
import { logClubAudit } from "@/lib/audit-logger";

// Define schema for club admin actions
const clubAdminActionSchema = z.object({
	clubId: z.string(),
	action: z.enum(["ban", "unban", "remove"]),
});

export const clubAdminAction = safeActionClient.schema(clubAdminActionSchema).action(async ({ parsedInput, ctx }) => {
	const { clubId, action } = parsedInput;

	if (action === "ban") {
		await prisma.club.update({
			where: { id: clubId },
			data: { banned: true },
		});

		// Log the audit event
		logClubAudit({
			clubId,
			actionType: "CLUB_BAN",
			actionData: {
				adminUserId: ctx.user.id,
				permanent: true,
			},
			userId: ctx.user.id,
		});
	} else if (action === "unban") {
		await prisma.club.update({
			where: { id: clubId },
			data: { banned: false, banReason: null, banExpires: null },
		});

		// Log the audit event
		logClubAudit({
			clubId,
			actionType: "CLUB_UNBAN",
			actionData: {
				adminUserId: ctx.user.id,
			},
			userId: ctx.user.id,
		});
	} else if (action === "remove") {
		// Log the audit event before deletion
		logClubAudit({
			clubId,
			actionType: "CLUB_DELETE",
			actionData: {
				adminUserId: ctx.user.id,
			},
			userId: ctx.user.id,
		});

		await prisma.club.delete({
			where: { id: clubId },
		});
	}

	return { success: true };
});
