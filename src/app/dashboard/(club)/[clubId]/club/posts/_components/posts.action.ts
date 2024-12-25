"use server";

import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { deletePostSchema, postSchema } from "./posts.schema";
import { revalidatePath } from "next/cache";

export const savePost = safeActionClient
	.schema(postSchema)
	.action(async ({ parsedInput, ctx }) => {
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

		revalidatePath(`/dashboard/${ctx.club.id}/club`);
		revalidatePath(`/dashboard/${ctx.club.id}/club/posts`);
		return { success: true, post };
	});

export const deletePost = safeActionClient
	.schema(deletePostSchema)
	.action(async ({ parsedInput, ctx }) => {
		await prisma.post.delete({
			where: {
				id: parsedInput.postId,
				clubId: ctx.club.id,
			},
		});

		revalidatePath(`/dashboard/${ctx.club.id}/club`);
		revalidatePath(`/dashboard/${ctx.club.id}/club/posts`);
		return { success: true };
	});
