"use server";

import { revalidateLocalizedPaths } from "@/i18n/revalidateLocalizedPaths";
import { awardEventBadgeForRegistration } from "@/lib/badges/badge-utils";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { toggleAttendanceSchema } from "./attendance.schema.ts";

export const toggleAttendance = safeActionClient
	.inputSchema(toggleAttendanceSchema)
	.action(async ({ parsedInput, ctx }) => {
		if (!ctx.club?.id) {
			throw new Error("Unauthorized");
		}

		// Verify the event belongs to the club
		const event = await prisma.event.findFirst({
			where: {
				id: parsedInput.eventId,
				clubId: ctx.club.id,
			},
		});

		if (!event) {
			throw new Error("Event not found");
		}

		const updated = await prisma.eventRegistration.update({
			where: {
				id: parsedInput.registrationId,
				eventId: parsedInput.eventId,
			},
			data: {
				attended: parsedInput.attended,
			},
		});

		// If attendance is marked as true, award badges
		if (parsedInput.attended) {
			await awardEventBadgeForRegistration(parsedInput.registrationId);
		}

		revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/events/${parsedInput.eventId}/attendance`);
		return updated;
	});
