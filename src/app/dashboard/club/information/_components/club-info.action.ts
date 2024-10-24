"use server";

import { NullableStringFieldUpdateOperationsInput } from "./../../../../../../node_modules/.prisma/client/index.d";
import {
	clubInfoSchema,
	clubLogoFileSchema,
	deleteClubImageSchema,
} from "@/app/dashboard/club/information/_components/club-info.schema";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { deleteS3File, getS3FileUploadUrl } from "@/lib/storage";
import { Prisma } from "@prisma/client";
import { id } from "date-fns/locale";
import type { data } from "framer-motion/client";
import { revalidatePath } from "next/cache";

export const saveClubInformation = safeActionClient
	.schema(clubInfoSchema)
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

		const club = await prisma.club.update({
			where: {
				id: isManager.clubId,
			},
			data: {
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
		});

		revalidatePath(`/dashboard/club/information?club=${club.id}`);
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

		const url = await getS3FileUploadUrl({
			type: parsedInput.file.type,
			size: parsedInput.file.size,
			key: `club/${isManager.clubId}/logo`,
		});

		return { url };
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
				logo: "https://f003.backblazeb2.com/file/airsoftba/club/default-club-image.png",
			},
		});

		await deleteS3File(`club/${parsedInput.id}/logo`);
		revalidatePath(`/dashboard/club/information?club=${parsedInput.id}`);

		return { success: true };
	});
