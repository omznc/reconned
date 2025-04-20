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
import { logClubAudit } from "@/lib/audit-logger";

export const saveClubInformation = safeActionClient.schema(clubInfoSchema).action(async ({ parsedInput, ctx }) => {
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

	const isCreate = !ctx.club?.id;
	const actionType = isCreate ? "CLUB_CREATE" : "CLUB_UPDATE";

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
			logo: parsedInput.logo ? `${parsedInput.logo}?v=${Date.now()}` : undefined,
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
			isPrivateStats: parsedInput.isPrivateStats,
			logo: parsedInput.logo ? `${parsedInput.logo}?v=${Date.now()}` : undefined,
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

	logClubAudit({
		clubId: club.id,
		actionType,
		actionData: {
			...parsedInput,
			dateFounded: parsedInput.dateFounded.toISOString(),
			logo: !!parsedInput.logo,
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

export const deleteClubImage = safeActionClient.schema(deleteClubImageSchema).action(async ({ ctx }) => {
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
	logClubAudit({
		clubId: ctx.club.id,
		actionType: "CLUB_UPDATE",
		actionData: {
			logoRemoved: true,
		},
	});

	revalidateLocalizedPaths(`/dashboard/club/information?club=${ctx.club.id}`);

	return { success: true };
});

export const disconnectInstagram = safeActionClient.schema(disconnectInstagramSchema).action(async ({ ctx }) => {
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

	// Log the audit event
	logClubAudit({
		clubId: ctx.club.id,
		actionType: "INSTAGRAM_DISCONNECT",
		actionData: {
			disconnectedBy: "manual",
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

export const disconnectInstagramAccount = safeActionClient.schema(disconnectInstagramSchema).action(async ({ ctx }) => {
	try {
		const success = await disconnectInstagramAPI(ctx.club.id);

		if (!success) {
			return {
				success: false,
				error: "Došlo je do greške prilikom odspajanja Instagram računa",
			};
		}

		// Log the audit event
		logClubAudit({
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
		logClubAudit({
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

export const deleteClub = safeActionClient.schema(deleteClubSchema).action(async ({ ctx }) => {
	// Log the audit event before deletion
	logClubAudit({
		clubId: ctx.club.id,
		actionType: "CLUB_DELETE",
		actionData: {
			clubId: ctx.club.id,
			clubName: ctx.club.name,
			clubSlug: ctx.club.slug,
		},
	});

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
