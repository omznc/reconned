"use server";

import { z } from "zod";
import { safeActionClient } from "@/lib/safe-action";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const schema = z.object({
	asClub: z.boolean(),
});

export const finalizeRegistration = safeActionClient
	.schema(schema)
	.action(async ({ parsedInput: { asClub }, ctx }) => {
		if (!asClub) {
			redirect("/");
		}

		// If we're registering as a club, a new club needs to be made, along with
		// a membership of type "owner" for the user.
		await prisma.club.create({
			data: {
				name: `Klub od ${ctx.user.name}`,
				members: {
					create: {
						userId: ctx.user.id,
						role: "CLUB_OWNER",
					},
				},
			},
		});

		redirect("/dashboard/club/information");
	});
