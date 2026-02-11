export const SUPPORTED_LANGUAGES = ["en", "bs", "sr"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function isValidLanguage(lang: unknown): lang is SupportedLanguage {
	return typeof lang === "string" && SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}
