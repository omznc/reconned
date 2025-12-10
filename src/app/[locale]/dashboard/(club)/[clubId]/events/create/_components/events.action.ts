"use server";
import type { Prisma } from "@generated/client";
import type { JsonValue } from "@prisma/client/runtime/client";
import { getLocale, getTranslations } from "next-intl/server";
import {
	createEventFormSchema,
	deleteEventImageSchema,
	deleteEventSchema,
	eventImageFileSchema,
} from "@/app/[locale]/dashboard/(club)/[clubId]/events/create/_components/events.schema";
import { createEmptySnapshot, normalizeMapData } from "@/components/map-editor/map-data";
import { validateSlug } from "@/components/slug/validate-slug";
import { redirect } from "@/i18n/navigation";
import { revalidateLocalizedPaths } from "@/i18n/revalidateLocalizedPaths";
import { logClubAudit } from "@/lib/audit-logger";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { getS3FileUploadUrl } from "@/lib/storage";
import { addImageVersion } from "@/lib/utils";

export const createEvent = safeActionClient.inputSchema(createEventFormSchema).action(async ({ parsedInput, ctx }) => {
	const t = await getTranslations("errors.events");

	// Validate slug
	if (parsedInput.slug) {
		const valid = await validateSlug({
			type: "event",
			slug: parsedInput.slug,
		});
		if (!valid) {
			throw new ActionError(t("slugAlreadyTaken"));
		}
	}

	const shouldDeleteImage = parsedInput.image === undefined;

	const mapData = normalizeMapData(parsedInput.mapData ?? createEmptySnapshot());
	const mapDataJson = JSON.parse(JSON.stringify(mapData)) as Prisma.InputJsonValue;

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
		image: parsedInput.image ? addImageVersion(parsedInput.image) : null,
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
		mapData: mapDataJson,
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
		throw new ActionError(t("cannotUpdateFinishedEvent"));
	}

	// If the event has an image and the image is being deleted, delete the image.
	if (shouldDeleteImage && parsedInput.eventId) {
		await deleteEventImage({
			eventId: parsedInput.eventId,
			clubId: ctx.club.id,
		});
	}

	// revalidate paths
	revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/events/`);
	if (!parsedInput.isPrivate) {
		revalidateLocalizedPaths("/");
		revalidateLocalizedPaths(`/events/${parsedInput.eventId}`);
	}

	await logClubAudit({
		clubId: ctx.club.id,
		actionType: parsedInput.eventId ? "EVENT_UPDATE" : "EVENT_CREATE",
		actionData: {
			id: parsedInput.eventId,
			name: parsedInput.name,
			description: parsedInput.description,
			costPerPerson: parsedInput.costPerPerson,
			location: parsedInput.location,
			googleMapsLink: parsedInput.googleMapsLink,
			dateStart: parsedInput.dateStart.toISOString(),
			dateEnd: parsedInput.dateEnd.toISOString(),
			dateRegistrationsOpen: parsedInput.dateRegistrationsOpen.toISOString(),
			dateRegistrationsClose: parsedInput.dateRegistrationsClose.toISOString(),
			image: parsedInput.image,
			isPrivate: parsedInput.isPrivate,
			allowFreelancers: parsedInput.allowFreelancers,
			hasBreakfast: parsedInput.hasBreakfast,
			hasLunch: parsedInput.hasLunch,
			hasDinner: parsedInput.hasDinner,
			hasSnacks: parsedInput.hasSnacks,
			hasDrinks: parsedInput.hasDrinks,
			hasPrizes: parsedInput.hasPrizes,
			slug: parsedInput.slug,
			rules: parsedInput.ruleIds,
			mapData: mapDataJson as JsonValue,
		},
	});

	// create or update event
	return await prisma.event.upsert({
		where: { id: parsedInput.eventId, clubId: ctx.club.id },
		update: data,
		create: data,
	});
});

export const getEventImageUploadUrl = safeActionClient
	.inputSchema(eventImageFileSchema)
	.action(async ({ parsedInput, ctx }) => {
		const t = await getTranslations("errors.events");

		const belongsToClub = await prisma.event.findFirst({
			where: {
				id: parsedInput.eventId,
				clubId: ctx.club.id,
			},
		});

		if (!belongsToClub) {
			throw new ActionError(t("eventDoesNotBelongToClub"));
		}

		const resp = await getS3FileUploadUrl({
			type: parsedInput.file.type,
			size: parsedInput.file.size,
			key: `event/${parsedInput.eventId}/cover`,
		});
		return resp;
	});

export const deleteEventImage = safeActionClient
	.inputSchema(deleteEventImageSchema)
	.action(async ({ parsedInput, ctx }) => {
		const t = await getTranslations("dashboard.club.events");

		await prisma.event.update({
			where: {
				id: parsedInput.eventId,
				clubId: ctx.club.id,
			},
			data: {
				image: null,
			},
		});

		await logClubAudit({
			clubId: ctx.club.id,
			actionType: "EVENT_UPDATE",
			actionData: {
				id: parsedInput.eventId,
				note: t("audit.imageDeleted"),
			},
		});
	});

export const deleteEvent = safeActionClient.inputSchema(deleteEventSchema).action(async ({ parsedInput, ctx }) => {
	const t = await getTranslations("errors.events");

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
		throw new ActionError(t("cannotDeleteFinishedEvent"));
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

	revalidateLocalizedPaths(`${locale}/dashboard/${ctx.club.id}/events/${parsedInput.eventId}`);

	if (!event.isPrivate) {
		revalidateLocalizedPaths(`${locale}/events/${parsedInput.eventId}`, "layout");
		revalidateLocalizedPaths(`${locale}/`);
	}

	await logClubAudit({
		clubId: ctx.club.id,
		actionType: "EVENT_DELETE",
		actionData: {
			id: parsedInput.eventId,
			name: event.name,
			description: event.description,
		},
	});

	return redirect({
		href: `/dashboard/${ctx.club.id}/events/`,
		locale,
	});
});
