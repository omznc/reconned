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
		// 1. Check if the user is logged in
		const user = await isAuthenticated();
		if (!user) {
			throw new Error("Session is not valid!");
		}

		// 2. Check if a clubId is provided. If not, allow the action to proceed
		const clubIdInput = clientInput as { clubId?: string };
		if (!clubIdInput.clubId) {
			return next({ ctx: { user, club: undefined as unknown as Club } });
		}

		// From this point on, we're checking if the user can change club information

		// 3. Validate the clubId
		const resp = clubIdSchema.safeParse(clientInput);
		if (!resp.success) {
			throw new Error("Invalid clubId provided");
		}

		// 4. Check if the club exists
		const club = await prisma.club.findUnique({
			where: { id: resp.data.clubId },
		});
		if (!club) {
			throw new Error("Club not found");
		}

		// 5. Check if the user is an admin or manages the club. If either are true, allow the action to proceed
		if (user.isAdmin || user.managedClubs.includes(resp.data.clubId)) {
			return next({ ctx: { user, club } });
		}

		// 6. If the user is not an admin and does not manage the club, throw an error
		throw new Error("User does not manage this club");
	},
);
