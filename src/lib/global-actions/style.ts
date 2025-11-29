"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";

export const setStyleAction = safeActionClient
	.inputSchema(
		z.object({
			style: z.union([z.literal("sharp"), z.literal("relaxed")]),
		}),
	)
	.action(async ({ parsedInput, ctx }) => {
		if (ctx.user.style === parsedInput.style) {
			return;
		}

		await prisma.user.update({
			where: { id: ctx.user.id },
			data: {
				style: parsedInput.style,
			},
		});
	});
