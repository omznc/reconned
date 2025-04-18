"use server";

import { safeActionClient } from "@/lib/safe-action";
import { prisma } from "@/lib/prisma";
import { eventApplicationSchema } from "./event-application.schema";
import { revalidateLocalizedPaths } from "@/i18n/revalidateLocalizedPaths";
import { nanoid } from "nanoid";
import { z } from "zod";

export const deleteRegistration = safeActionClient
	.schema(
		z.object({
			eventId: z.string(),
		}),
	)
	.action(async ({ parsedInput, ctx }) => {
		const event = await prisma.event.findUniqueOrThrow({
			where: { id: parsedInput.eventId },
			select: {
				id: true,
				isPrivate: true,
				clubId: true,
			},
		});

		// Find registration where the user is the creator
		const registration = await prisma.eventRegistration.findFirst({
			where: {
				eventId: event.id,
				createdById: ctx.user.id,
			},
		});

		if (!registration) {
			throw new Error("Prijava nije pronađena");
		}

		// Delete registration (this will cascade delete invites)
		await prisma.eventRegistration.delete({
			where: {
				id: registration.id,
			},
		});

		// Revalidate paths
		revalidateLocalizedPaths(`/events/${event.id}`);
		revalidateLocalizedPaths(`/dashboard/${event.clubId}/events/${event.id}`);
		if (!event.isPrivate) {
			revalidateLocalizedPaths("/");
		}
	});

export const submitEventApplication = safeActionClient
	.schema(eventApplicationSchema)
	.action(async ({ parsedInput, ctx }) => {
		const { type, invitedUsers, invitedUsersNotOnApp, paymentMethod, eventId } = parsedInput;

		// Validation checks
		const event = await prisma.event.findUniqueOrThrow({
			where: { id: eventId },
			select: {
				id: true,
				dateRegistrationsClose: true,
				isPrivate: true,
				clubId: true,
			},
		});

		if (event.dateRegistrationsClose < new Date()) {
			throw new Error("Registracije su zatvorene za ovaj susret");
		}

		if (event.isPrivate) {
			const isClubMember = await prisma.clubMembership.findFirst({
				where: {
					clubId: event.clubId,
					userId: ctx.user.id,
				},
			});

			if (!isClubMember) {
				throw new Error("Nemate pristup ovom susretu");
			}
		}

		// Check if user already created a registration
		const existingRegistration = await prisma.eventRegistration.findFirst({
			where: {
				eventId: event.id,
				createdById: ctx.user.id,
			},
		});

		// Start transaction
		await prisma.$transaction(async (tx) => {
			if (existingRegistration) {
				// Update existing registration
				await tx.eventRegistration.update({
					where: {
						id: existingRegistration.id,
					},
					data: {
						type,
						paymentMethod,
						invitedUsers: {
							set: invitedUsers.map((user) => ({ id: user.id })),
						},
						invitedUsersNotOnApp: {
							deleteMany: {},
							create: invitedUsersNotOnApp.map((user) => ({
								name: user.name,
								email: user.email,
								token: nanoid(),
								expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
								eventId,
							})),
						},
					},
				});
			} else {
				// Create new registration
				await tx.eventRegistration.create({
					data: {
						eventId,
						type,
						paymentMethod,
						createdById: ctx.user.id,
						invitedUsers: {
							connect: invitedUsers.map((user) => ({
								id: user.id,
							})),
						},
						invitedUsersNotOnApp: {
							create: invitedUsersNotOnApp.map((user) => ({
								name: user.name,
								email: user.email,
								token: nanoid(),
								expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
								eventId,
							})),
						},
					},
				});
			}
		});

		// Revalidate paths
		revalidateLocalizedPaths(`/events/${event.id}`);
		revalidateLocalizedPaths(`/dashboard/${event.clubId}/events/${event.id}`);
		if (!event.isPrivate) {
			revalidateLocalizedPaths("/");
		}
	});
