import type { NavItem } from "./types.ts";

/**
 * Get all available translations for an item based on the translation key
 * @param key Translation key
 * @param locales Available locales to fetch translations for
 * @param getTranslation Function to get translation for a key in a specific locale
 * @returns Record of locale to translation
 */
export function getTranslationsForKey(
	key: string,
	locales: string[],
	getTranslation: (locale: string, key: string) => string,
): Record<string, string> {
	const translations: Record<string, string> = {};

	for (const locale of locales) {
		try {
			const translation = getTranslation(locale, key);
			translations[locale] = translation;
		} catch (error) {
			// Skip if translation is not available
		}
	}

	return translations;
}

/**
 * Search items across all available locales
 * @param items Items to search through
 * @param searchTerm Search term
 * @returns Filtered items with matchedLocale set for items that matched in a non-current locale
 */
export function searchAcrossLocales(
	items: NavItem[],
	searchTerm: string,
	currentLocale: string,
): NavItem[] {
	if (!searchTerm) {
		return items;
	}

	const lowerSearch = searchTerm.toLowerCase();
	const result: NavItem[] = [];

	for (const item of items) {
		// Check if current locale title matches
		const currentTitle = item.title.toLowerCase();
		if (currentTitle.includes(lowerSearch)) {
			// Match in current locale - no need to indicate matched locale
			result.push({ ...item });
			continue;
		}

		// Check if club name matches (in current locale)
		if (item.club?.name && item.club.name.toLowerCase().includes(lowerSearch)) {
			result.push({ ...item });
			continue;
		}

		// Check translations in other locales
		let matched = false;
		if (item.titleTranslations) {
			for (const [locale, translation] of Object.entries(
				item.titleTranslations,
			)) {
				// Skip current locale as we already checked it
				if (locale === currentLocale) {
					continue;
				}

				if (translation.toLowerCase().includes(lowerSearch)) {
					// Match in another locale - indicate which one matched
					result.push({
						...item,
						matchedLocale: locale,
					});
					matched = true;
					break;
				}
			}
		}

		// If we already found a match in another locale, continue to next item
		if (matched) {
			continue;
		}
	}

	return result;
}
