import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Club } from "@prisma/client";
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";

export const unsafeActionClient = createSafeActionClient();

const clubIdSchema = z.object({
	clubId: z.string(),
});

/**
 * If the underyling schema requires a clubId, this action will check if the user is authenticated and if they manage the club.
 * If the user is authenticated and manages the club, the action will proceed.
 * Otherwise, it will only check if the user is signed in.
 * The club in the context will be undefined if the user is not managing the club, or if the clubId is not provided.
 */
export const safeActionClient = unsafeActionClient.use(
	async ({ clientInput, next }) => {
		const user = await isAuthenticated();

		if (!user) {
			throw new Error("Session is not valid!");
		}

		const clubIdInput = clientInput as { clubId?: string };
		if (!clubIdInput.clubId) {
			return next({ ctx: { user, club: undefined as unknown as Club } });
		}

		const resp = clubIdSchema.safeParse(clientInput);
		if (!resp.success) {
			throw new Error("Invalid clubId provided");
		}

		const club = await prisma.club.findUnique({
			where: { id: resp.data.clubId },
		});
		if (!club) {
			throw new Error("Club not found");
		}

		if (user.isAdmin || user.managedClubs.includes(resp.data.clubId)) {
			return next({ ctx: { user, club } });
		}

		throw new Error("User does not manage this club");
	},
);
