"use server";
import {
	clubInfoSchema,
	clubLogoFileSchema,
	deleteClubImageSchema,
	deleteClubSchema,
} from "@/app/dashboard/(club)/[clubId]/club/information/_components/club-info.schema";
import { validateSlug } from "@/components/slug/validate-slug";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { deleteS3File, getS3FileUploadUrl } from "@/lib/storage";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

export const saveClubInformation = safeActionClient
	.schema(clubInfoSchema)
	.action(async ({ parsedInput, ctx }) => {
		// Validate slug
		if (parsedInput.slug) {
			const valid = await validateSlug({
				type: "club",
				slug: parsedInput.slug,
			});
			if (!valid) {
				throw new Error("Izabrani link je već zauzet.");
			}
		}

		const club = await prisma.club.upsert({
			where: {
				id: ctx.club?.id ?? "",
			},
			update: {
				name: parsedInput.name,
				location: parsedInput.location,
				description: parsedInput.description,
				dateFounded: parsedInput.dateFounded,
				isAllied: parsedInput.isAllied,
				isPrivate: parsedInput.isPrivate,
				logo: parsedInput.logo
					? `${parsedInput.logo}?v=${Date.now()}`
					: undefined,
				contactPhone: parsedInput.contactPhone,
				contactEmail: parsedInput.contactEmail,
				slug: parsedInput.slug ? parsedInput.slug : undefined,
				latitude: parsedInput.latitude,
				longitude: parsedInput.longitude,
				countryId: parsedInput.countryId,
			},
			create: {
				name: parsedInput.name,
				location: parsedInput.location,
				description: parsedInput.description,
				dateFounded: parsedInput.dateFounded,
				isAllied: parsedInput.isAllied,
				isPrivate: parsedInput.isPrivate,
				logo: parsedInput.logo
					? `${parsedInput.logo}?v=${Date.now()}`
					: undefined,
				contactPhone: parsedInput.contactPhone,
				contactEmail: parsedInput.contactEmail,
				latitude: parsedInput.latitude,
				longitude: parsedInput.longitude,
				slug: parsedInput.slug ? parsedInput.slug : undefined,
				countryId: parsedInput.countryId,
				members: {
					create: {
						userId: ctx.user.id,
						role: "CLUB_OWNER",
					},
				},
			},
		});

		revalidateTag("managed-clubs");
		revalidatePath(`/dashboard/${club.id}`, "layout");
		if (!club?.isPrivate) {
			revalidatePath(`/clubs/${club.id}`, "layout");
		}

		return { id: club.id };
	});

export const getClubImageUploadUrl = safeActionClient
	.schema(clubLogoFileSchema)
	.action(async ({ parsedInput, ctx }) => {
		const key = `club/${ctx.club.id}/logo`;

		const resp = await getS3FileUploadUrl({
			type: parsedInput.file.type,
			size: parsedInput.file.size,
			key,
		});

		return resp;
	});

export const deleteClubImage = safeActionClient
	.schema(deleteClubImageSchema)
	.action(async ({ ctx }) => {
		await prisma.club.update({
			where: {
				id: ctx.club.id,
			},
			data: {
				logo: null,
			},
		});

		await deleteS3File(`club/${ctx.club.id}/logo`);
		revalidatePath(`/dashboard/club/information?club=${ctx.club.id}`);

		return { success: true };
	});

export const deleteClub = safeActionClient
	.schema(deleteClubSchema)
	.action(async ({ ctx }) => {
		await Promise.all([
			prisma.club.delete({
				where: {
					id: ctx.club.id,
				},
			}),
			await deleteClubImage({
				clubId: ctx.club.id,
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

		revalidateTag("managed-clubs");
		revalidatePath(`/dashboard/${ctx.club.id}`, "layout");
		if (!ctx.club.isPrivate) {
			revalidatePath(`/clubs/${ctx.club.id}`, "layout");
		}
		redirect(remaining > 0 ? "/dashboard?autoSelectFirst=true" : "/");
	});
