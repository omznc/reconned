"use server";
import {
	createEventFormSchema,
	deleteEventImageSchema,
	deleteEventSchema,
	eventImageFileSchema,
} from "@/app/[locale]/dashboard/(club)/[clubId]/events/create/_components/events.schema";
import { validateSlug } from "@/components/slug/validate-slug";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { getS3FileUploadUrl } from "@/lib/storage";
import { revalidateLocalizedPaths } from "@/i18n/navigation";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

export const createEvent = safeActionClient
	.schema(createEventFormSchema)
	.action(async ({ parsedInput, ctx }) => {
		// Validate slug
		if (parsedInput.slug) {
			const valid = await validateSlug({
				type: "event",
				slug: parsedInput.slug,
			});
			if (!valid) {
				throw new Error("Izabrani link je već zauzet.");
			}
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
			image: parsedInput.image
				? `${parsedInput.image}?v=${Date.now()}`
				: undefined,
			isPrivate: parsedInput.isPrivate,
			allowFreelancers: parsedInput.allowFreelancers,
			hasBreakfast: parsedInput.hasBreakfast,
			hasLunch: parsedInput.hasLunch,
			hasDinner: parsedInput.hasDinner,
			hasSnacks: parsedInput.hasSnacks,
			hasDrinks: parsedInput.hasDrinks,
			hasPrizes: parsedInput.hasPrizes,
			slug: parsedInput.slug ? parsedInput.slug : undefined,
			clubId: ctx.club.id,
			rules: {
				connect: parsedInput.ruleIds?.map((id) => ({ id })) || [],
			},
			mapData: parsedInput.mapData ?? { areas: [], pois: [] },
		};

		// If the event has ended, you can't update it.
		const eventFinished = await prisma.event.findFirst({
			where: {
				id: parsedInput.eventId,
				clubId: ctx.club.id,
				dateEnd: {
					lte: new Date(),
				},
			},
		});

		if (eventFinished) {
			throw new Error("Ne možete ažurirati susret koji je već završio.");
		}

		// revalidate paths
		revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/events/`);
		if (!parsedInput.isPrivate) {
			revalidateLocalizedPaths("/");
			revalidateLocalizedPaths(`/events/${parsedInput.eventId}`);
		}

		// create or update event
		return await prisma.event.upsert({
			where: { id: parsedInput.eventId, clubId: ctx.club.id },
			update: data,
			create: data,
		});
	});

export const getEventImageUploadUrl = safeActionClient
	.schema(eventImageFileSchema)
	.action(async ({ parsedInput, ctx }) => {
		const belongsToClub = await prisma.event.findFirst({
			where: {
				id: parsedInput.eventId,
				clubId: ctx.club.id,
			},
		});

		if (!belongsToClub) {
			throw new Error("Event does not belong to your club");
		}

		const resp = await getS3FileUploadUrl({
			type: parsedInput.file.type,
			size: parsedInput.file.size,
			key: `event/${parsedInput.eventId}/cover`,
		});
		return resp;
	});

export const deleteEventImage = safeActionClient
	.schema(deleteEventImageSchema)
	.action(async ({ parsedInput, ctx }) => {
		await prisma.event.update({
			where: {
				id: parsedInput.eventId,
				clubId: ctx.club.id,
			},
			data: {
				image: null,
			},
		});
	});

export const deleteEvent = safeActionClient
	.schema(deleteEventSchema)
	.action(async ({ parsedInput, ctx }) => {
		// If the event is in the past, you can't delete it.
		const eventFinished = await prisma.event.findFirst({
			where: {
				id: parsedInput.eventId,
				clubId: ctx.club.id,
				dateEnd: {
					lte: new Date(),
				},
			},
		});
		const locale = await getLocale();

		if (eventFinished) {
			throw new Error("Ne možete obrisati susret koji je već završio.");
		}

		const [event, _] = await Promise.all([
			prisma.event.delete({
				where: {
					id: parsedInput.eventId,
					clubId: ctx.club.id,
				},
			}),
			await deleteEventImage({
				eventId: parsedInput.eventId,
				clubId: ctx.club.id,
			}),
		]);

		revalidateLocalizedPaths(
			`${locale}/dashboard/${ctx.club.id}/events/${parsedInput.eventId}`,
		);

		if (!event.isPrivate) {
			revalidateLocalizedPaths(
				`${locale}/events/${parsedInput.eventId}`,
				"layout",
			);
			revalidateLocalizedPaths(`${locale}/`);
		}

		return redirect({
			href: `/dashboard/${ctx.club.id}/events/`,
			locale,
		});
	});
