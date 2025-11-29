import "server-only";
import { after } from "next/server";
import { env } from "@/lib/env";
import { detectLanguage, translateToAllLocales } from "@/lib/openrouter";
import { prisma } from "@/lib/prisma";

interface QueueTranslationParams {
	entity: "club" | "event" | "user";
	entityId: string;
	text: string;
}

/**
 * Queue a translation job for the provided entity description/bio.
 * Uses Next.js after() to keep the action response fast.
 */
export function queueDescriptionTranslation({ entity, entityId, text }: QueueTranslationParams) {
	if (!text || !text.trim()) {
		return;
	}

	if (!env.OPENROUTER_API_KEY) {
		return;
	}

	after(async () => {
		const detectedLocale = (await detectLanguage(text)) ?? "bs";
		const translations = await translateToAllLocales(text, detectedLocale);

		if (Object.keys(translations).length === 0) {
			return;
		}

		if (entity === "club") {
			await prisma.club.update({
				where: { id: entityId },
				data: {
					descriptionJson: translations,
				},
			});
			return;
		}

		if (entity === "event") {
			await prisma.event.update({
				where: { id: entityId },
				data: {
					descriptionJson: translations,
				},
			});
			return;
		}

		if (entity === "user") {
			await prisma.user.update({
				where: { id: entityId },
				data: {
					bioJson: translations,
				},
			});
		}
	});
}
