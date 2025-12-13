"use server";
import { revalidateTag } from "next/cache";
import { getLocale } from "next-intl/server";
import {
	clubHeaderFileSchema,
	clubInfoSchema,
	clubLogoFileSchema,
	deleteClubImageSchema,
	deleteClubSchema,
	disconnectInstagramSchema,
} from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.schema";
import { validateSlug } from "@/components/slug/validate-slug";
import { redirect } from "@/i18n/navigation";
import { revalidateLocalizedPaths } from "@/i18n/revalidateLocalizedPaths";
import { logClubAudit } from "@/lib/audit-logger";
import { disconnectInstagramAPI } from "@/lib/instagram";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { deleteS3File, getS3FileUploadUrl } from "@/lib/storage";
import { addImageVersion } from "@/lib/utils";

export const saveClubInformation = safeActionClient.inputSchema(clubInfoSchema).action(async ({ parsedInput, ctx }) => {
	// Validate slug
	if (parsedInput.slug) {
		const valid = await validateSlug({
			type: "club",
			slug: parsedInput.slug,
		});
		if (!valid) {
			throw new ActionError("Izabrani link je već zauzet.");
		}
	}

	const isCreate = !ctx.club?.id;
	const actionType = isCreate ? "CLUB_CREATE" : "CLUB_UPDATE";
	const shouldDeleteLogo = parsedInput.logo === undefined;
	const shouldDeleteHeaderImage = parsedInput.headerImage === undefined;

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
			isPrivateStats: parsedInput.isPrivateStats,
			logo: parsedInput.logo ? addImageVersion(parsedInput.logo) : null,
			headerImage: parsedInput.headerImage ? addImageVersion(parsedInput.headerImage) : null,
			contactPhone: parsedInput.contactPhone,
			contactEmail: parsedInput.contactEmail,
			slug: parsedInput.slug ? parsedInput.slug : null,
			latitude: parsedInput.latitude,
			longitude: parsedInput.longitude,
			countryId: parsedInput.countryId,
			instagramUsername: parsedInput.instagramUsername,
			website: parsedInput.website,
		},
		create: {
			name: parsedInput.name,
			location: parsedInput.location,
			description: parsedInput.description,
			dateFounded: parsedInput.dateFounded,
			isAllied: parsedInput.isAllied,
			isPrivate: parsedInput.isPrivate,
			isPrivateStats: parsedInput.isPrivateStats,
			logo: parsedInput.logo ? addImageVersion(parsedInput.logo) : undefined,
			headerImage: parsedInput.headerImage ? addImageVersion(parsedInput.headerImage) : undefined,
			contactPhone: parsedInput.contactPhone,
			contactEmail: parsedInput.contactEmail,
			latitude: parsedInput.latitude,
			longitude: parsedInput.longitude,
			slug: parsedInput.slug ? parsedInput.slug : undefined,
			countryId: parsedInput.countryId,
			instagramUsername: parsedInput.instagramUsername,
			website: parsedInput.website,
			members: {
				create: {
					userId: ctx.user.id,
					role: "CLUB_OWNER",
				},
			},
		},
	});

	if (shouldDeleteLogo) {
		await deleteClubImage({
			clubId: club.id,
		});
	}

	if (shouldDeleteHeaderImage) {
		await deleteClubHeaderImage({
			clubId: club.id,
		});
	}

	await logClubAudit({
		clubId: club.id,
		actionType,
		actionData: {
			...parsedInput,
			dateFounded: parsedInput.dateFounded.toISOString(),
			logo: !!parsedInput.logo,
		},
	});

	revalidateTag("managed-clubs", "max");
	revalidateLocalizedPaths(`/dashboard/${club.id}`, "layout");
	if (!club?.isPrivate) {
		revalidateLocalizedPaths(`/clubs/${club.slug ?? club.id}`);
		revalidateLocalizedPaths("/clubs");
		revalidateLocalizedPaths("/search");
	}

	return { id: club.id };
});

export const getClubImageUploadUrl = safeActionClient
	.inputSchema(clubLogoFileSchema)
	.action(async ({ parsedInput, ctx }) => {
		const key = `club/${ctx.club.id}/logo`;

		const resp = await getS3FileUploadUrl({
			type: parsedInput.file.type,
			size: parsedInput.file.size,
			key,
		});

		return resp;
	});

export const getClubHeaderImageUploadUrl = safeActionClient
	.inputSchema(clubHeaderFileSchema)
	.action(async ({ parsedInput, ctx }) => {
		const key = `club/${ctx.club.id}/header`;

		const resp = await getS3FileUploadUrl({
			type: parsedInput.file.type,
			size: parsedInput.file.size,
			key,
		});

		return resp;
	});

export const deleteClubImage = safeActionClient.inputSchema(deleteClubImageSchema).action(async ({ ctx }) => {
	await prisma.club.update({
		where: {
			id: ctx.club.id,
		},
		data: {
			logo: null,
		},
	});

	await deleteS3File(`club/${ctx.club.id}/logo`);

	// Log the audit event
	await logClubAudit({
		clubId: ctx.club.id,
		actionType: "CLUB_UPDATE",
		actionData: {
			logoRemoved: true,
		},
	});

	revalidateLocalizedPaths(`/dashboard/club/information?club=${ctx.club.id}`);

	return { success: true };
});

export const deleteClubHeaderImage = safeActionClient.inputSchema(deleteClubImageSchema).action(async ({ ctx }) => {
	await prisma.club.update({
		where: {
			id: ctx.club.id,
		},
		data: {
			headerImage: null,
		},
	});

	await deleteS3File(`club/${ctx.club.id}/header`);

	// Log the audit event
	await logClubAudit({
		clubId: ctx.club.id,
		actionType: "CLUB_UPDATE",
		actionData: {
			headerImageRemoved: true,
		},
	});

	revalidateLocalizedPaths(`/dashboard/club/information?club=${ctx.club.id}`);

	return { success: true };
});

export const disconnectInstagramAccount = safeActionClient
	.inputSchema(disconnectInstagramSchema)
	.action(async ({ ctx }) => {
		try {
			const success = await disconnectInstagramAPI(ctx.club.id);

			if (!success) {
				return {
					success: false,
					error: "Došlo je do greške prilikom odspajanja Instagram računa",
				};
			}

			// Log the audit event
			await logClubAudit({
				clubId: ctx.club.id,
				actionType: "INSTAGRAM_DISCONNECT",
				actionData: {
					disconnectedBy: "api",
					success: true,
				},
			});

			revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/club/information`, "page");
			if (!ctx.club.isPrivate) {
				revalidateLocalizedPaths(`/clubs/${ctx.club.slug ?? ctx.club.id}`);
				revalidateLocalizedPaths("/clubs");
				revalidateLocalizedPaths("/search");
			}

			return { success: true };
		} catch (error) {
			// Log the audit event even if there's an error
			await logClubAudit({
				clubId: ctx.club.id,
				actionType: "INSTAGRAM_DISCONNECT",
				actionData: {
					disconnectedBy: "api",
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});

			return {
				success: false,
				error: "Došlo je do greške prilikom odspajanja Instagram računa",
			};
		}
	});

export const deleteClub = safeActionClient.inputSchema(deleteClubSchema).action(async ({ ctx }) => {
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

	revalidateTag("managed-clubs", "max");
	revalidateLocalizedPaths(`/dashboard/${ctx.club.id}`, "layout");
	if (!ctx.club.isPrivate) {
		revalidateLocalizedPaths(`/clubs/${ctx.club.slug ?? ctx.club.id}`);
		revalidateLocalizedPaths("/clubs");
		revalidateLocalizedPaths("/search");
	}
	return redirect({
		href: remaining > 0 ? "/dashboard" : "/",
		locale,
	});
});
