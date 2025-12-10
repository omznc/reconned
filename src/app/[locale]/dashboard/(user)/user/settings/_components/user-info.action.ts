"use server";
import { getTranslations } from "next-intl/server";
import {
	userAvatarFileSchema,
	userHeaderFileSchema,
	userInfoShema,
} from "@/app/[locale]/dashboard/(user)/user/settings/_components/user-info.schema";
import { validateSlug } from "@/components/slug/validate-slug";
import { revalidateLocalizedPaths } from "@/i18n/revalidateLocalizedPaths";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { deleteS3File, getS3FileUploadUrl } from "@/lib/storage";
import { addImageVersion } from "@/lib/utils";

export const saveUserInformation = safeActionClient.inputSchema(userInfoShema).action(async ({ parsedInput, ctx }) => {
	const t = await getTranslations();
	// Validate slug
	if (parsedInput.slug) {
		const valid = await validateSlug({
			type: "user",
			slug: parsedInput.slug,
		});
		if (!valid) {
			throw new ActionError(t("dashboard.user.settings.linkTaken"));
		}
	}

	const shouldDeleteImage = parsedInput.image === undefined;
	const shouldDeleteHeaderImage = parsedInput.headerImage === undefined;

	const user = await prisma.user.update({
		where: {
			id: ctx.user.id,
		},
		data: {
			name: parsedInput.name,
			isPrivate: parsedInput.isPrivate,
			image: parsedInput.image ? addImageVersion(parsedInput.image) : null,
			headerImage: parsedInput.headerImage ? addImageVersion(parsedInput.headerImage) : null,
			bio: parsedInput.bio,
			location: parsedInput.location,
			website: parsedInput.website,
			phone: parsedInput.phone,
			slug: parsedInput.slug ? parsedInput.slug : undefined,
			callsign: parsedInput.callsign,
			isPrivateEmail: parsedInput.isPrivateEmail,
			isPrivatePhone: parsedInput.isPrivatePhone,
			isPrivateStats: parsedInput.isPrivateStats,
		},
	});

	if (shouldDeleteImage) {
		await deleteUserImage();
	}

	if (shouldDeleteHeaderImage) {
		await deleteUserHeaderImage();
	}

	revalidateLocalizedPaths("/dashboard/user/");
	if (!user.isPrivate) {
		revalidateLocalizedPaths(`/users/${user.slug ?? user.id}`);
		revalidateLocalizedPaths("/users");
		revalidateLocalizedPaths("/search");
	}
});

export const getUserImageUploadUrl = safeActionClient
	.inputSchema(userAvatarFileSchema)
	.action(async ({ parsedInput, ctx }) => {
		const resp = await getS3FileUploadUrl({
			type: parsedInput.file.type,
			size: parsedInput.file.size,
			key: `user/${ctx.user.id}/image`,
		});

		return resp;
	});

export const getUserHeaderImageUploadUrl = safeActionClient
	.inputSchema(userHeaderFileSchema)
	.action(async ({ parsedInput, ctx }) => {
		const resp = await getS3FileUploadUrl({
			type: parsedInput.file.type,
			size: parsedInput.file.size,
			key: `user/${ctx.user.id}/header`,
		});

		return resp;
	});

export const deleteUserImage = safeActionClient.action(async ({ ctx }) => {
	const user = await prisma.user.update({
		where: {
			id: ctx.user.id,
		},
		data: {
			image: null,
		},
	});

	try {
		await deleteS3File(`user/${ctx.user.id}/image`);
	} catch (error) {
		logger.warn("Failed to delete S3 file:", { error });
	}

	revalidateLocalizedPaths("/dashboard/user/");
	if (!user.isPrivate) {
		revalidateLocalizedPaths(`/users/${user.slug ?? user.id}`);
		revalidateLocalizedPaths("/users");
		revalidateLocalizedPaths("/search");
	}
});

export const deleteUserHeaderImage = safeActionClient.action(async ({ ctx }) => {
	const user = await prisma.user.update({
		where: {
			id: ctx.user.id,
		},
		data: {
			headerImage: null,
		},
	});

	try {
		await deleteS3File(`user/${ctx.user.id}/header`);
	} catch (error) {
		logger.warn("Failed to delete S3 file:", { error });
	}

	revalidateLocalizedPaths("/dashboard/user/");
	if (!user.isPrivate) {
		revalidateLocalizedPaths(`/users/${user.slug ?? user.id}`);
		revalidateLocalizedPaths("/users");
		revalidateLocalizedPaths("/search");
	}
});
