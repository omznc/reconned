"use server";

import { clubLogoFileSchema } from "@/app/dashboard/(club)/[clubId]/club/information/_components/club-info.schema";
import {
	createEventFormSchema,
	deleteEventImageSchema,
} from "@/app/dashboard/(club)/[clubId]/events/create/_components/create-event-form.schema";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { getS3FileUploadUrl } from "@/lib/storage";

export const createEvent = safeActionClient
	.schema(createEventFormSchema)
	.action(async ({ parsedInput, ctx }) => {
		const isManager = await prisma.clubMembership.findFirst({
			where: {
				userId: ctx.user.id,
				role: {
					in: ["CLUB_OWNER", "MANAGER"],
				},
				club: {
					id: parsedInput.clubId,
				},
			},
		});

		if (!isManager) {
			throw new Error("You are not authorized to perform this action.");
		}

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
			clubId: parsedInput.clubId,
			mapData: parsedInput.mapData ?? { areas: [], pois: [] },
		};

		// create or update event
		return prisma.event.upsert({
			where: { id: parsedInput.id },
			update: data,
			create: data,
		});
	});

export const getEventImageUploadUrl = safeActionClient
	.schema(clubLogoFileSchema)
	.action(async ({ parsedInput, ctx }) => {
		const isManager = await prisma.clubMembership.findFirst({
			where: {
				userId: ctx.user.id,
				role: {
					in: ["CLUB_OWNER", "MANAGER"],
				},
				club: {
					events: {
						some: {
							id: parsedInput.id,
						},
					},
				},
			},
		});

		if (!isManager) {
			throw new Error("You are not authorized to perform this action.");
		}

		const resp = await getS3FileUploadUrl({
			type: parsedInput.file.type,
			size: parsedInput.file.size,
			key: `event/${parsedInput.id}/cover`,
		});

		return resp;
	});

export const deleteEventImage = safeActionClient
	.schema(deleteEventImageSchema)
	.action(async ({ parsedInput, ctx }) => {
		const isManager = await prisma.clubMembership.findFirst({
			where: {
				userId: ctx.user.id,
				role: {
					in: ["CLUB_OWNER", "MANAGER"],
				},
				club: {
					events: {
						some: {
							id: parsedInput.id,
						},
					},
				},
			},
		});

		if (!isManager) {
			throw new Error("You are not authorized to perform this action.");
		}

		await prisma.event.update({
			where: {
				id: parsedInput.id,
			},
			data: {
				coverImage: "",
			},
		});
	});
