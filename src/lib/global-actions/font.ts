"use server";

import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { z } from "zod";

export const setFontAction = safeActionClient
	.schema(
		z.object({
			font: z.union([z.literal("sans"), z.literal("mono")]),
		}),
	)
	.action(async ({ parsedInput, ctx }) => {
		if (ctx.user.font === parsedInput.font) {
			return;
		}

		await prisma.user.update({
			where: { id: ctx.user.id },
			data: {
				font: parsedInput.font,
			},
		});
	});
