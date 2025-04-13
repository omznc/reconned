"use server";

import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { Role } from "@prisma/client";
import { revalidateLocalizedPaths } from "@/i18n/navigation";
import {
	demoteFromManagerSchema,
	promoteToManagerSchema,
} from "@/app/[locale]/dashboard/(club)/[clubId]/members/managers/_components/manager.schema";

export const promoteToManager = safeActionClient
	.schema(promoteToManagerSchema)
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
				throw new Error("Član nije pronađen ili je već menadžer.");
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
	.schema(demoteFromManagerSchema)
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
				throw new Error("Menadžer nije pronađen.");
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
