import "server-only";
import { VALID_LOCALES } from "@/i18n/valid-locales";
import { env } from "@/lib/env";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "x-ai/grok-beta";

interface OpenRouterMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

interface OpenRouterResponse {
	choices: {
		message: {
			content: string;
		};
	}[];
}

async function callOpenRouter(messages: OpenRouterMessage[]): Promise<string | null> {
	if (!env.OPENROUTER_API_KEY) {
		console.warn("OpenRouter API key not configured, skipping translation");
		return null;
	}

	try {
		const response = await fetch(OPENROUTER_API_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: MODEL,
				messages,
			}),
		});

		if (!response.ok) {
			console.error("OpenRouter API error:", response.status, response.statusText);
			return null;
		}

		const data = (await response.json()) as OpenRouterResponse;
		return data.choices[0]?.message?.content || null;
	} catch (error) {
		console.error("OpenRouter API call failed:", error);
		return null;
	}
}

/**
 * Detect which locale a text is written in
 * Returns the detected locale code or null if detection failed
 */
export async function detectLanguage(text: string): Promise<string | null> {
	if (!text || text.trim().length === 0) {
		return null;
	}

	const localeNames = VALID_LOCALES.map((locale) => {
		if (locale === "bs") {
			return "Bosnian";
		}
		if (locale === "en") {
			return "English";
		}
		return locale;
	}).join(", ");

	const messages: OpenRouterMessage[] = [
		{
			role: "system",
			content: `You are a language detection assistant. Your task is to detect which language the given text is written in. The possible languages are: ${localeNames}. 
Respond with ONLY the language code: ${VALID_LOCALES.join(", ")}. 
Do not include any explanation or additional text, just the language code.`,
		},
		{
			role: "user",
			content: text,
		},
	];

	const result = await callOpenRouter(messages);
	if (!result) {
		return null;
	}

	// Clean up the response and validate it's a valid locale
	const detectedLocale = result.trim().toLowerCase();
	if (VALID_LOCALES.includes(detectedLocale as (typeof VALID_LOCALES)[number])) {
		return detectedLocale;
	}

	return null;
}

/**
 * Translate text from one language to another
 */
export async function translateText(text: string, fromLocale: string, toLocale: string): Promise<string | null> {
	if (!text || text.trim().length === 0) {
		return null;
	}

	const fromLanguage = fromLocale === "bs" ? "Bosnian" : "English";
	const toLanguage = toLocale === "bs" ? "Bosnian" : "English";

	const messages: OpenRouterMessage[] = [
		{
			role: "system",
			content: `You are a professional translator. Translate the following text from ${fromLanguage} to ${toLanguage}. 
Preserve the original meaning, tone, and formatting. 
Respond with ONLY the translated text, without any explanations or additional comments.`,
		},
		{
			role: "user",
			content: text,
		},
	];

	return await callOpenRouter(messages);
}

/**
 * Translate text to all supported locales
 * Returns an object with locale codes as keys and translated text as values
 */
export async function translateToAllLocales(text: string, sourceLocale: string): Promise<Record<string, string>> {
	const translations: Record<string, string> = {
		[sourceLocale]: text,
	};

	for (const locale of VALID_LOCALES) {
		if (locale === sourceLocale) {
			continue;
		}

		const translation = await translateText(text, sourceLocale, locale);
		if (translation) {
			translations[locale] = translation;
		}
	}

	return translations;
}
