"use server";

import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { deletePostSchema, postSchema } from "./posts.schema";
import { revalidateLocalizedPaths } from "@/i18n/revalidateLocalizedPaths";
import { logClubAudit } from "@/lib/audit-logger";

export const savePost = safeActionClient.schema(postSchema).action(async ({ parsedInput, ctx }) => {
	const post = parsedInput.id
		? await prisma.post.update({
				where: {
					id: parsedInput.id,
					clubId: ctx.club.id,
				},
				data: {
					title: parsedInput.title,
					content: parsedInput.content,
					// images: parsedInput.images,
					isPublic: parsedInput.isPublic,
				},
			})
		: await prisma.post.create({
				data: {
					title: parsedInput.title,
					content: parsedInput.content,
					// images: parsedInput.images || [],
					isPublic: parsedInput.isPublic,
					clubId: ctx.club.id,
				},
			});

	logClubAudit({
		clubId: ctx.club.id,
		actionType: post.id ? "POST_UPDATE" : "POST_CREATE",
		actionData: {
			id: post.id,
			title: parsedInput.title,
			content: parsedInput.content,
			isPublic: parsedInput.isPublic,
			// images: parsedInput.images || [],
		},
		userId: ctx.user.id,
	});

	revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/club`);
	revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/club/posts`);
	return { success: true, post };
});

export const deletePost = safeActionClient.schema(deletePostSchema).action(async ({ parsedInput, ctx }) => {
	await prisma.post.delete({
		where: {
			id: parsedInput.postId,
			clubId: ctx.club.id,
		},
	});

	logClubAudit({
		clubId: ctx.club.id,
		actionType: "POST_DELETE",
		actionData: {
			id: parsedInput.postId,
		},
		userId: ctx.user.id,
	});

	revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/club`);
	revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/club/posts`);
	return { success: true };
});
