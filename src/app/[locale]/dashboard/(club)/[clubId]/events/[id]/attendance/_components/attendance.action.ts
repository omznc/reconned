"use server";

import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { toggleAttendanceSchema } from "./attendance.schema";
import { revalidateLocalizedPaths } from "@/i18n/revalidateLocalizedPaths";

export const toggleAttendance = safeActionClient
	.schema(toggleAttendanceSchema)
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

		revalidateLocalizedPaths(
			`/dashboard/${ctx.club.id}/events/${parsedInput.eventId}/attendance`,
		);
		return updated;
	});
