import type { Locale } from "date-fns";
import { bs, enUS, hr, sr } from "date-fns/locale";

/**
 * Maps application locale strings to date-fns Locale objects
 * @param locale - The application locale string (e.g., "en", "bs", "hr", "sr")
 * @returns The corresponding date-fns Locale object
 */
export function getDateFnsLocale(locale: string): Locale {
	switch (locale) {
		case "bs":
			return bs;
		case "hr":
			return hr;
		case "sr":
			return sr;
		default:
			return enUS;
	}
}

/**
 * Hook-friendly version that works with next-intl's useLocale
 * @param locale - The application locale string from useLocale()
 * @returns The corresponding date-fns Locale object
 */
export function useDateFnsLocale(locale: string): Locale {
	return getDateFnsLocale(locale);
}
