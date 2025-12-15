import { z } from "zod";
import { ActionError } from "@/lib/action-error";
import apiClient from "@/lib/api";
import { eventApplicationSchema } from "./event-application.schema.ts";

export async function deleteRegistration(input: unknown) {
	const schema = z.object({
		eventId: z.string(),
	});
	const parsed = schema.safeParse(input);
	if (!parsed.success) {
		throw new ActionError("Neispravni podaci za brisanje prijave.");
	}

	const { eventId } = parsed.data;

	const { error } = await apiClient.DELETE("/api/events/{id}/registrations", {
		params: {
			path: {
				id: eventId,
			},
		},
	});

	if (error) {
		throw new ActionError(error.error ?? "Prijava nije pronađena");
	}
}

export async function submitEventApplication(input: unknown) {
	const parsed = eventApplicationSchema.safeParse(input);
	if (!parsed.success) {
		throw new ActionError("Neispravni podaci za prijavu na susret.");
	}

	const { type, invitedUsers, invitedUsersNotOnApp, paymentMethod, eventId } = parsed.data;

	const { error } = await apiClient.POST("/api/events/{id}/registrations", {
		params: {
			path: {
				id: eventId,
			},
		},
		body: {
			type,
			paymentMethod,
			invitedUsers: invitedUsers.map((user) => ({
				id: user.id,
			})),
			invitedUsersNotOnApp: invitedUsersNotOnApp.map((user) => ({
				name: user.name,
				email: user.email,
			})),
		},
	});

	if (error) {
		throw new ActionError(error.error ?? "Došlo je do greške prilikom prijave.");
	}
}
