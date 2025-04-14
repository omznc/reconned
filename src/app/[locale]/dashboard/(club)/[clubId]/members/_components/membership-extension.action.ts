"use server";

import { safeActionClient } from "@/lib/safe-action";
import { prisma } from "@/lib/prisma";
import { revalidateLocalizedPaths } from "@/i18n/revalidateLocalizedPaths";
import { addMonths } from "date-fns";
import { membershipExtensionSchema } from "@/app/[locale]/dashboard/(club)/[clubId]/members/_components/membership-extension.schema";

export const extendMembership = safeActionClient
	.schema(membershipExtensionSchema)
	.action(async ({ parsedInput, ctx }) => {
		const { memberId, clubId, duration } = parsedInput;
		try {
			// Find the membership
			const membership = await prisma.clubMembership.findFirst({
				where: {
					id: memberId,
					clubId,
				},
			});

			if (!membership) {
				return { error: "Membership not found" };
			}

			// Calculate new dates
			const today = new Date();
			let baseDate = membership.endDate || membership.startDate || today;
			if (!baseDate) {
				baseDate = today;
			}

			// If endDate is in the past, use today as the base date
			if (baseDate < today) {
				baseDate = today;
			}

			// Convert duration string to number
			const durationMonths = Number.parseInt(duration);

			// Calculate new end date
			const newEndDate = addMonths(baseDate, durationMonths);

			// Update the membership
			const updatedMembership = await prisma.clubMembership.update({
				where: { id: memberId },
				data: {
					endDate: newEndDate,
					startDate: membership.startDate || today, // Ensure startDate is set
				},
			});

			// Revalidate path to update UI
			revalidateLocalizedPaths(`/dashboard/${clubId}/members`);

			return {
				success: true,
				membership: updatedMembership,
				message: `Membership extended by ${durationMonths} months`,
			};
		} catch (error) {
			return { error: "Failed to extend membership" };
		}
	});
