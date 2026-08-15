import type { Locale } from "date-fns";
import { bs, enUS, hr, sr } from "date-fns/locale";

/**
 * Fixed time zone for date formatting.
 *
 * The server runs in UTC and the browser runs in the visitor's own zone. A date
 * near a day boundary then renders as a different day on each side, and React
 * fails hydration with error #418. A fixed zone makes both sides agree.
 */
export const APP_TIME_ZONE = "Europe/Sarajevo";

/**
 * Formats a date with the fixed application time zone.
 *
 * Use this for any date that a client component renders, because Next.js also
 * renders that component on the server. `new Date(...).toLocaleDateString(...)`
 * without a `timeZone` uses the host zone and breaks hydration.
 *
 * @param date - A `Date`, an ISO string, or a timestamp.
 * @param locale - The application locale string from `useLocale()`.
 * @param options - Extra `Intl.DateTimeFormatOptions`.
 */
export function formatDate(date: Date | string | number, locale: string, options?: Intl.DateTimeFormatOptions): string {
	return new Date(date).toLocaleDateString(locale, { timeZone: APP_TIME_ZONE, ...options });
}

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
