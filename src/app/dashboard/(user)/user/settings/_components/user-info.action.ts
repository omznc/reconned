"use server";
import {
	userImageFileSchema,
	userInfoShema,
} from "@/app/dashboard/(user)/user/settings/_components/user-info.schema";
import { validateSlug } from "@/components/slug/validate-slug";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { deleteS3File, getS3FileUploadUrl } from "@/lib/storage";
import { revalidatePath } from "next/cache";

export const saveUserInformation = safeActionClient
	.schema(userInfoShema)
	.action(async ({ parsedInput, ctx }) => {
		// Validate slug
		if (parsedInput.slug) {
			const valid = await validateSlug({
				type: "user",
				slug: parsedInput.slug,
			});
			if (!valid) {
				throw new Error("Izabrani link je već zauzet.");
			}
		}

		const user = await prisma.user.update({
			where: {
				id: ctx.user.id,
			},
			data: {
				name: parsedInput.name,
				email: parsedInput.email,
				isPrivate: parsedInput.isPrivate,
				image: `${parsedInput.image}?v=${Date.now()}`,
				bio: parsedInput.bio,
				location: parsedInput.location,
				website: parsedInput.website,
				phone: parsedInput.phone,
				slug: parsedInput.slug,
				callsign: parsedInput.callsign,
			},
		});

		revalidatePath("/dashboard/user/");
		if (!user.isPrivate) {
			revalidatePath(`/user/${user.id}`);
		}
	});

export const getUserImageUploadUrl = safeActionClient
	.schema(userImageFileSchema)
	.action(async ({ parsedInput, ctx }) => {
		const resp = await getS3FileUploadUrl({
			type: parsedInput.file.type,
			size: parsedInput.file.size,
			key: `user/${ctx.user.id}/image`,
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

	await deleteS3File(`user/${ctx.user.id}/image`);

	revalidatePath("/dashboard/user/");
	if (!user.isPrivate) {
		revalidatePath(`/user/${user.id}`);
	}
});
