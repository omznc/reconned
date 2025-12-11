import type { Club } from "@generated/client";
import { Logger } from "next-axiom";
import { getTranslations } from "next-intl/server";
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";
import { ActionError } from "@/lib/action-error";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const unsafeActionClient = createSafeActionClient({
	// Can also be an async function.
	async handleServerError(e) {
		const t = await getTranslations("errors");
		if (e instanceof ActionError) {
			return e.message;
		}
		return t("errors.default");
	},
});

const clubIdSchema = z.object({
	clubId: z.string(),
});
const logger = new Logger({ source: "server-action" });
const t = await getTranslations("errors");

/**
 * If the underyling schema requires a clubId, this action will check if the user is authenticated and if they manage the club.
 * If the user is authenticated and manages the club, the action will proceed.
 * Otherwise, it will only check if the user is signed in.
 * The club in the context will be undefined if the user is not managing the club, or if the clubId is not provided.
 */
export const safeActionClient = unsafeActionClient.use(async ({ clientInput, next }) => {
	// 1. Check if the user is logged in
	const user = await isAuthenticated();
	if (!user) {
		logger.info("User not authenticated", {
			input: clientInput,
		});
		throw new ActionError(t("safeAction.userNotAuthenticated"));
	}

	// 2. Check if a clubId is provided. If not, allow the action to proceed
	const clubIdInput = clientInput as { clubId?: string };
	if (!clubIdInput?.clubId) {
		logger.info("No clubId provided", {
			input: clientInput,
			user,
		});
		return next({ ctx: { user, club: undefined as unknown as Club } });
	}

	// From this point on, we're checking if the user can change club information

	// 3. Validate the clubId
	const resp = clubIdSchema.safeParse(clientInput);
	if (!resp.success) {
		logger.info("Invalid clubId provided", {
			input: clientInput,
			user,
		});
		throw new ActionError(t("safeAction.invalidClubIdProvided"));
	}

	// 4. Check if the club exists
	const club = await prisma.club.findUnique({
		where: { id: resp.data.clubId },
	});
	if (!club) {
		logger.info("Club not found", {
			input: clientInput,
			user,
		});
		throw new ActionError(t("safeAction.clubNotFound"));
	}

	// 5. Check if the user is an admin or manages the club. If either are true, allow the action to proceed
	if (user.role === "admin" || user.managedClubs.includes(resp.data.clubId)) {
		return next({ ctx: { user, club } });
	}

	// 6. If the user is not an admin and does not manage the club, throw an error
	logger.info("User does not manage this club", {
		input: clientInput,
		user,
		club,
	});
	throw new ActionError(t("safeAction.userDoesNotManageClub"));
});

/**
 * If the underyling schema requires a admin role, this action will check if the user is authenticated and if they are an admin.
 * If the user is authenticated and is an admin, the action will proceed.
 * Functionally similar to safeActionClient, but this enforces the admin role instead of the admin role bypassing the club check.
 * Otherwise, it will throw an error.
 */
export const adminActionClient = unsafeActionClient.use(async ({ next }) => {
	const user = await isAuthenticated();
	if (!user) {
		throw new ActionError(t("safeAction.userNotAuthenticated"));
	}

	if (user.role !== "admin") {
		throw new ActionError(t("safeAction.userIsNotAdmin"));
	}

	return next({ ctx: { user } });
});
