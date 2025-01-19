"use server";

import { VALID_LOCALES } from "@/i18n/request";
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
		if (!VALID_LOCALES.includes(parsedInput.language)) {
			throw new Error("Invalid language");
		}

		if (ctx.user.language === parsedInput.language) {
			return;
		}

		await prisma.user.update({
			where: { id: ctx.user.id },
			data: {
				language: parsedInput.language,
			},
		});
	});
