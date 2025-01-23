"use server";

import { VALID_LOCALES } from "@/i18n/valid-locales";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { z } from "zod";

export const setLanguageAction = safeActionClient
	.schema(
		z.object({
			language: z.string(),
		}),
	)
	.action(async ({ parsedInput, ctx }) => {
		if (!VALID_LOCALES.includes(parsedInput.language as never)) {
			throw new Error("Invalid language");
		}

		const user = await prisma.user.findUnique({
			where: { id: ctx.user.id },
			select: { language: true },
		});

		if (user?.language === parsedInput.language) {
			return;
		}

		await prisma.user.update({
			where: { id: ctx.user.id },
			data: {
				language: parsedInput.language,
			},
		});
	});
