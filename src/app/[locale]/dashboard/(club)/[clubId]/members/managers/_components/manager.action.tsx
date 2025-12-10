"use server";

import { Role } from "@generated/client";
import {
	demoteFromManagerSchema,
	promoteToManagerSchema,
} from "@/app/[locale]/dashboard/(club)/[clubId]/members/managers/_components/manager.schema";
import { revalidateLocalizedPaths } from "@/i18n/revalidateLocalizedPaths";
import { logClubAudit } from "@/lib/audit-logger";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";

export const promoteToManager = safeActionClient
	.inputSchema(promoteToManagerSchema)
	.action(async ({ parsedInput, ctx }) => {
		try {
			const targetMembership = await prisma.clubMembership.findFirst({
				where: {
					id: parsedInput.memberId,
					clubId: ctx.club.id,
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
				throw new ActionError("Član nije pronađen ili je već menadžer.");
			}

			const updatedMembership = await prisma.clubMembership.update({
				where: {
					id: parsedInput.memberId,
					clubId: ctx.club.id,
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

			// Log the audit event
			await logClubAudit({
				clubId: ctx.club.id,
				actionType: "MEMBER_PROMOTE",
				actionData: {
					memberId: parsedInput.memberId,
					memberName: targetMembership.user.name,
					memberEmail: targetMembership.user.email,
					fromRole: targetMembership.role,
					toRole: Role.MANAGER,
				},
			});

			revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/members`);

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

export const demoteFromManager = safeActionClient
	.inputSchema(demoteFromManagerSchema)
	.action(async ({ parsedInput, ctx }) => {
		try {
			const targetMembership = await prisma.clubMembership.findFirst({
				where: {
					id: parsedInput.memberId,
					clubId: ctx.club.id,
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

			if (!targetMembership) {
				throw new ActionError("Menadžer nije pronađen.");
			}

			const updatedMembership = await prisma.clubMembership.update({
				where: {
					id: parsedInput.memberId,
					clubId: ctx.club.id,
				},
				data: {
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

			// Log the audit event
			await logClubAudit({
				clubId: ctx.club.id,
				actionType: "MEMBER_DEMOTE",
				actionData: {
					memberId: parsedInput.memberId,
					memberName: targetMembership.user.name,
					memberEmail: targetMembership.user.email,
					fromRole: targetMembership.role,
					toRole: Role.USER,
				},
			});

			revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/members`);

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
