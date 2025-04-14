"use server";
import {
	clubInfoSchema,
	clubLogoFileSchema,
	deleteClubImageSchema,
	deleteClubSchema,
	disconnectInstagramSchema,
} from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.schema";
import { validateSlug } from "@/components/slug/validate-slug";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { deleteS3File, getS3FileUploadUrl } from "@/lib/storage";
import { revalidateTag } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { revalidateLocalizedPaths } from "@/i18n/revalidateLocalizedPaths";
import { getLocale } from "next-intl/server";
import { disconnectInstagramAPI } from "@/lib/instagram";

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
				instagramUsername: parsedInput.instagramUsername,
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
				instagramUsername: parsedInput.instagramUsername,
				members: {
					create: {
						userId: ctx.user.id,
						role: "CLUB_OWNER",
					},
				},
			},
		});

		revalidateTag("managed-clubs");
		revalidateLocalizedPaths(`/dashboard/${club.id}`, "layout");
		if (!club?.isPrivate) {
			revalidateLocalizedPaths(`/clubs/${club.slug ?? club.id}`);
			revalidateLocalizedPaths("/clubs");
			revalidateLocalizedPaths("/search");
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
		revalidateLocalizedPaths(`/dashboard/club/information?club=${ctx.club.id}`);

		return { success: true };
	});

export const disconnectInstagram = safeActionClient
	.schema(disconnectInstagramSchema)
	.action(async ({ ctx }) => {
		await prisma.club.update({
			where: {
				id: ctx.club.id,
			},
			data: {
				instagramUsername: null,
				instagramAccessToken: null,
				instagramRefreshToken: null,
				instagramTokenExpiry: null,
				instagramProfilePictureUrl: null,
				instagramConnected: false,
			},
		});

		revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/club/information`);
		if (!ctx.club.isPrivate) {
			revalidateLocalizedPaths(`/clubs/${ctx.club.slug ?? ctx.club.id}`);
			revalidateLocalizedPaths("/clubs");
			revalidateLocalizedPaths("/search");
		}

		return { success: true };
	});

export const disconnectInstagramAccount = safeActionClient
	.schema(disconnectInstagramSchema)
	.action(async ({ ctx }) => {
		try {
			const success = await disconnectInstagramAPI(ctx.club.id);

			if (!success) {
				return {
					success: false,
					error: "Došlo je do greške prilikom odspajanja Instagram računa",
				};
			}

			revalidateLocalizedPaths(
				`/dashboard/${ctx.club.id}/club/information`,
				"page",
			);
			if (!ctx.club.isPrivate) {
				revalidateLocalizedPaths(`/clubs/${ctx.club.slug ?? ctx.club.id}`);
				revalidateLocalizedPaths("/clubs");
				revalidateLocalizedPaths("/search");
			}

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: "Došlo je do greške prilikom odspajanja Instagram računa",
			};
		}
	});

export const deleteClub = safeActionClient
	.schema(deleteClubSchema)
	.action(async ({ ctx }) => {
		const [, , locale] = await Promise.all([
			prisma.club.delete({
				where: {
					id: ctx.club.id,
				},
			}),
			deleteClubImage({
				clubId: ctx.club.id,
			}),
			getLocale(),
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
		revalidateLocalizedPaths(`/dashboard/${ctx.club.id}`, "layout");
		if (!ctx.club.isPrivate) {
			revalidateLocalizedPaths(`/clubs/${ctx.club.slug ?? ctx.club.id}`);
			revalidateLocalizedPaths("/clubs");
			revalidateLocalizedPaths("/search");
		}
		return redirect({
			href: remaining > 0 ? "/dashboard?autoSelectFirst=true" : "/",
			locale,
		});
	});
