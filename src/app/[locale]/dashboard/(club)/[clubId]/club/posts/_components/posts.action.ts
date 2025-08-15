"use server";

import { revalidateLocalizedPaths } from "@/i18n/revalidateLocalizedPaths";
import { logClubAudit } from "@/lib/audit-logger";
import { generateSecureFilename } from "@/lib/file-security";
import { prisma } from "@/lib/prisma";
import { imageUploadRateLimit } from "@/lib/rate-limit";
import { safeActionClient } from "@/lib/safe-action";
import { deleteS3Files, getS3FileUploadUrl } from "@/lib/storage";
import { deletePostSchema, postImageUploadSchema, postSchema } from "./posts.schema.ts";

export const savePost = safeActionClient.inputSchema(postSchema).action(async ({ parsedInput, ctx }) => {
	let imagesToDelete: string[] = [];

	if (parsedInput.id) {
		const existingPost = await prisma.post.findUnique({
			where: {
				id: parsedInput.id,
				clubId: ctx.club.id,
			},
			select: {
				images: true,
			},
		});

		if (existingPost?.images) {
			const newImages = parsedInput.images || [];
			imagesToDelete = existingPost.images.filter((url) => !newImages.includes(url));
		}
	}

	const post = parsedInput.id
		? await prisma.post.update({
				where: {
					id: parsedInput.id,
					clubId: ctx.club.id,
				},
				data: {
					title: parsedInput.title,
					content: parsedInput.content,
					images: parsedInput.images,
					isPublic: parsedInput.isPublic,
				},
			})
		: await prisma.post.create({
				data: {
					title: parsedInput.title,
					content: parsedInput.content,
					images: parsedInput.images || [],
					isPublic: parsedInput.isPublic,
					clubId: ctx.club.id,
				},
			});

	if (imagesToDelete.length > 0) {
		const imageKeys = imagesToDelete.map((url) => {
			const urlObj = new URL(url);
			return urlObj.pathname.substring(1);
		});
		await deleteS3Files(imageKeys);
	}

	await logClubAudit({
		clubId: ctx.club.id,
		actionType: post.id ? "POST_UPDATE" : "POST_CREATE",
		actionData: {
			id: post.id,
			title: parsedInput.title,
			content: parsedInput.content,
			isPublic: parsedInput.isPublic,
			images: parsedInput.images || [],
		},
	});

	revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/club`);
	revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/club/posts`);
	return { success: true, post };
});

export const deletePost = safeActionClient.inputSchema(deletePostSchema).action(async ({ parsedInput, ctx }) => {
	const post = await prisma.post.findUnique({
		where: {
			id: parsedInput.postId,
			clubId: ctx.club.id,
		},
		select: {
			images: true,
		},
	});

	if (post?.images && post.images.length > 0) {
		const imageKeys = post.images.map((url) => {
			const urlObj = new URL(url);
			return urlObj.pathname.substring(1);
		});
		await deleteS3Files(imageKeys);
	}

	await prisma.post.delete({
		where: {
			id: parsedInput.postId,
			clubId: ctx.club.id,
		},
	});

	await logClubAudit({
		clubId: ctx.club.id,
		actionType: "POST_DELETE",
		actionData: {
			id: parsedInput.postId,
		},
	});

	revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/club`);
	revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/club/posts`);
	return { success: true };
});

export const getPostImageUploadUrl = safeActionClient
	.inputSchema(postImageUploadSchema)
	.action(async ({ parsedInput, ctx }) => {
		// Rate limiting - 5 image uploads per minute per user
		const rateLimitResult = await imageUploadRateLimit.limit(ctx.user.id);
		if (!rateLimitResult.success) {
			const resetTime = rateLimitResult.reset ? new Date(rateLimitResult.reset).toLocaleTimeString() : "soon";
			throw new Error(`Too many upload attempts. Try again at ${resetTime}.`);
		}

		// Generate secure filename
		const secureFilename = generateSecureFilename(parsedInput.file.name);
		const key = `post-images/${ctx.club?.id}/${secureFilename}`;

		const resp = await getS3FileUploadUrl({
			type: parsedInput.file.type,
			size: parsedInput.file.size,
			key,
			clubId: ctx.club?.id,
			userId: ctx.user.id,
		});

		return resp;
	});
