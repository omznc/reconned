"use server";
import { clubLogoFileSchema } from "@/app/dashboard/(club)/[clubId]/club/information/_components/club-info.schema";
import {
	createEventFormSchema,
	deleteEventImageSchema,
	deleteEventSchema,
} from "@/app/dashboard/(club)/[clubId]/events/create/_components/create-event-form.schema";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { getS3FileUploadUrl } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export const createEvent = safeActionClient
	.schema(createEventFormSchema)
	.action(async ({ parsedInput, ctx }) => {
		const data = {
			name: parsedInput.name,
			description: parsedInput.description,
			costPerPerson: parsedInput.costPerPerson,
			location: parsedInput.location,
			googleMapsLink: parsedInput.googleMapsLink,
			dateStart: parsedInput.dateStart,
			dateEnd: parsedInput.dateEnd,
			dateRegistrationsOpen: parsedInput.dateRegistrationsOpen,
			dateRegistrationsClose: parsedInput.dateRegistrationsClose,
			coverImage: parsedInput.coverImage,
			isPrivate: parsedInput.isPrivate,
			allowFreelancers: parsedInput.allowFreelancers,
			hasBreakfast: parsedInput.hasBreakfast,
			hasLunch: parsedInput.hasLunch,
			hasDinner: parsedInput.hasDinner,
			hasSnacks: parsedInput.hasSnacks,
			hasDrinks: parsedInput.hasDrinks,
			hasPrizes: parsedInput.hasPrizes,
			clubId: ctx.club.id,
			mapData: parsedInput.mapData ?? { areas: [], pois: [] },
		};

		// revalidate paths
		revalidatePath(`/dashboard/${ctx.club.id}/events/`);
		if (!parsedInput.isPrivate) {
			revalidatePath("/");
			revalidatePath(`/events/${parsedInput.id}`);
		}

		// create or update event
		return await prisma.event.upsert({
			where: { id: parsedInput.id },
			update: data,
			create: data,
		});
	});

export const getEventImageUploadUrl = safeActionClient
	.schema(clubLogoFileSchema)
	.action(async ({ parsedInput, ctx }) => {
		const resp = await getS3FileUploadUrl({
			type: parsedInput.file.type,
			size: parsedInput.file.size,
			key: `event/${ctx.club.id}/cover`,
		});

		return resp;
	});

export const deleteEventImage = safeActionClient
	.schema(deleteEventImageSchema)
	.action(async ({ parsedInput }) => {
		await prisma.event.update({
			where: {
				id: parsedInput.id,
			},
			data: {
				coverImage: null,
			},
		});
	});

export const deleteEvent = safeActionClient
	.schema(deleteEventSchema)
	.action(async ({ parsedInput, ctx }) => {
		const [event, _] = await Promise.all([
			prisma.event.delete({
				where: {
					id: parsedInput.id,
				},
			}),
			await deleteEventImage({
				id: parsedInput.id,
			}),
		]);

		revalidatePath(`/dashboard/${ctx.club.id}/events/${parsedInput.id}`);

		if (!event.isPrivate) {
			revalidatePath(`/events/${parsedInput.id}`, "layout");
			revalidatePath("/");
		}

		redirect(`/dashboard/${ctx.club.id}`);
	});
