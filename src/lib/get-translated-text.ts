import "server-only";

type TranslationsJson = Record<string, string> | null | undefined;

/**
 * Get translated text from a JSON field
 * Returns the text in the requested locale, or falls back to any available translation, or the original description
 */
export function getTranslatedText(
	translationsJson: TranslationsJson,
	fallbackText: string | null | undefined,
	locale: string,
): string {
	// If no translations JSON, return the fallback
	if (!translationsJson || typeof translationsJson !== "object") {
		return fallbackText || "";
	}

	// Try to get the requested locale
	if (translationsJson[locale]) {
		return translationsJson[locale];
	}

	// Try to get the first available translation
	const firstAvailableTranslation = Object.values(translationsJson)[0];
	if (firstAvailableTranslation) {
		return firstAvailableTranslation;
	}

	// Fall back to original description
	return fallbackText || "";
}
