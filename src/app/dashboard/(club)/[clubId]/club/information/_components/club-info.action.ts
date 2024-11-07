"use server";
import {
	clubInfoSchema,
	clubLogoFileSchema,
	deleteClubImageSchema,
	deleteClubSchema,
} from "@/app/dashboard/(club)/[clubId]/club/information/_components/club-info.schema";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { deleteS3File, getS3FileUploadUrl } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export const saveClubInformation = safeActionClient
	.schema(clubInfoSchema)
	.action(async ({ parsedInput, ctx }) => {
		if (parsedInput.id) {
			const isManager = await prisma.clubMembership.findFirst({
				where: {
					userId: ctx.user.id,
					role: {
						in: ["CLUB_OWNER", "MANAGER"],
					},
					clubId: parsedInput.id,
				},
			});

			if (!isManager) {
				throw new Error("You are not authorized to perform this action.");
			}
		}

		const club = await prisma.club.upsert({
			where: {
				id: parsedInput.id || "",
			},
			update: {
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
			create: {
				name: parsedInput.name,
				location: parsedInput.location,
				description: parsedInput.description,
				dateFounded: parsedInput.dateFounded,
				isAllied: parsedInput.isAllied,
				isPrivate: parsedInput.isPrivate,
				logo: parsedInput.logo,
				contactPhone: parsedInput.contactPhone,
				contactEmail: parsedInput.contactEmail,
				members: {
					create: {
						userId: ctx.user.id,
						role: "CLUB_OWNER",
					},
				},
			},
		});

		revalidatePath(`/dashboard/${club.id}`, "layout");
		if (!club.isPrivate) {
			revalidatePath(`/clubs/${club.id}`, "layout");
		}

		return { id: club.id };
	});

export const getClubImageUploadUrl = safeActionClient
	.schema(clubLogoFileSchema)
	.action(async ({ parsedInput, ctx }) => {
		const isManager = await prisma.clubMembership.findFirst({
			where: {
				userId: ctx.user.id,
				role: {
					in: ["CLUB_OWNER", "MANAGER"],
				},
				clubId: parsedInput.id,
			},
		});

		if (!isManager) {
			throw new Error("You are not authorized to perform this action.");
		}

		const key = `club/${isManager.clubId}/logo`;

		const resp = await getS3FileUploadUrl({
			type: parsedInput.file.type,
			size: parsedInput.file.size,
			key,
		});

		return resp;
	});

export const deleteClubImage = safeActionClient
	.schema(deleteClubImageSchema)
	.action(async ({ parsedInput, ctx }) => {
		const isManager = await prisma.clubMembership.findFirst({
			where: {
				userId: ctx.user.id,
				role: {
					in: ["CLUB_OWNER", "MANAGER"],
				},
				clubId: parsedInput.id,
			},
		});

		if (!isManager) {
			throw new Error("You are not authorized to perform this action.");
		}

		await prisma.club.update({
			where: {
				id: parsedInput.id,
			},
			data: {
				logo: null,
			},
		});

		await deleteS3File(`club/${parsedInput.id}/logo`);
		revalidatePath(`/dashboard/club/information?club=${parsedInput.id}`);

		return { success: true };
	});

export const deleteClub = safeActionClient
	.schema(deleteClubSchema)
	.action(async ({ parsedInput, ctx }) => {
		const isManager = await prisma.clubMembership.findFirst({
			where: {
				userId: ctx.user.id,
				role: {
					in: ["CLUB_OWNER", "MANAGER"],
				},
				clubId: parsedInput.id,
			},
		});

		if (!isManager) {
			throw new Error("You are not authorized to perform this action.");
		}

		const [club, _] = await Promise.all([
			prisma.club.delete({
				where: {
					id: parsedInput.id,
				},
			}),
			await deleteClubImage({
				id: parsedInput.id,
			}),
		]);

		const remaining = await prisma.club.count({
			where: {
				members: {
					some: {
						userId: ctx.user.id,
					},
				},
			},
		});

		revalidatePath(`/dashboard/${parsedInput.id}`, "layout");
		if (!club.isPrivate) {
			revalidatePath(`/clubs/${parsedInput.id}`, "layout");
		}
		redirect(remaining > 0 ? "/dashboard?autoSelectFirst=true" : "/");
	});
