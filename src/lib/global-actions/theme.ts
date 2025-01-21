"use server";

import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { z } from "zod";

export const setThemeAction = safeActionClient
	.schema(
		z.object({
			theme: z.union([z.literal("light"), z.literal("dark")]),
		}),
	)
	.action(async ({ parsedInput, ctx }) => {
		if (ctx.user.theme === parsedInput.theme) {
			return;
		}

		await prisma.user.update({
			where: { id: ctx.user.id },
			data: {
				theme: parsedInput.theme,
			},
		});
	});
