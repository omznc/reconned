"use server";

import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { leaveClubSchema, removeMemberSchema } from "./members.schema";
import { revalidateLocalizedPaths } from "@/i18n/revalidateLocalizedPaths";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { logClubAudit } from "@/lib/audit-logger";

export const removeMember = safeActionClient.schema(removeMemberSchema).action(async ({ parsedInput, ctx }) => {
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
						id: true,
						name: true,
						email: true,
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
			},
		});

		logClubAudit({
			clubId: parsedInput.clubId,
			actionType: "MEMBER_REMOVE",
			actionData: {
				memberId: parsedInput.memberId,
				memberName: membership.user.name,
				memberEmail: membership.user.email,
				memberRole: membership.role,
				userId: membership.user.id,
				removedBy: "manager",
			},
		});

		revalidateLocalizedPaths(`/dashboard/${parsedInput.clubId}/members`);

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

export const leaveClub = safeActionClient.schema(leaveClubSchema).action(async ({ parsedInput, ctx }) => {
	try {
		// First check if the user is the club owner
		const membership = await prisma.clubMembership.findFirst({
			where: {
				clubId: parsedInput.clubId,
				userId: ctx.user.id,
			},
		});

		if (!membership) {
			throw new Error("Niste član ovog kluba.");
		}

		if (membership.role === "CLUB_OWNER") {
			throw new Error(
				"Vlasnik kluba ne može napustiti klub. Morate prvo prenijeti vlasništvo ili obrisati klub.",
			);
		}

		logClubAudit({
			clubId: parsedInput.clubId,
			actionType: "MEMBER_LEAVE",
			actionData: {
				memberId: membership.id,
				memberRole: membership.role,
				userId: ctx.user.id,
			},
		});

		// Delete the membership
		await prisma.clubMembership.delete({
			where: {
				id: membership.id,
			},
		});

		const locale = await getLocale();

		// Redirect to dashboard
		return redirect({
			href: "/dashboard?autoSelectFirst=true",
			locale,
		});
	} catch (error) {
		if (error instanceof Error) {
			return {
				success: false,
				error: error.message,
			};
		}
		return {
			success: false,
			error: "Došlo je do neočekivane greške prilikom napuštanja kluba.",
		};
	}
});
