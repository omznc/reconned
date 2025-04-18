"use server";

import { safeActionClient } from "@/lib/safe-action";
import { requestAccessSchema } from "./request-access.schema";
import { prisma } from "@/lib/prisma";

export const requestAccess = safeActionClient.schema(requestAccessSchema).action(async ({ parsedInput, ctx }) => {
	const existingRequest = await prisma.clubInvite.findFirst({
		where: {
			clubId: parsedInput.clubIdTarget,
			email: ctx.user.email,
			status: {
				in: ["PENDING", "REQUESTED"],
			},
		},
	});

	if (existingRequest) {
		return {
			success: false,
			error: "Već ste poslali zahtjev za pristup ovom klubu.",
		};
	}

	// If already a member, return early
	const existingMember = await prisma.clubMembership.findFirst({
		where: {
			clubId: parsedInput.clubIdTarget,
			userId: ctx.user.id,
		},
	});

	if (existingMember) {
		return {
			success: false,
			error: "Već ste član ovog kluba.",
		};
	}

	const invite = await prisma.clubInvite.create({
		data: {
			clubId: parsedInput.clubIdTarget,
			email: ctx.user.email,
			userId: ctx.user.id,
			status: "REQUESTED",
			inviteCode: Math.random().toString(36).substring(2, 16).toUpperCase(),
			expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
		},
	});

	return { success: true, data: invite };
});
