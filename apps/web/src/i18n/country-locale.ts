import type { routing } from "./routing";

const COUNTRY_TO_LOCALE: Record<string, (typeof routing.locales)[number]> = {
	BA: "bs",
	HR: "bs",
	RS: "sr",
};

/**
 * Geo hint for first-visit locale negotiation. Countries outside the region
 * fall back to `en`, not the site default — a visitor from Germany with no
 * matching `Accept-Language` should get English, not Bosnian.
 */
export function getLocaleFromCountry(country: string | null): (typeof routing.locales)[number] {
	if (!country) {
		return "en";
	}
	return COUNTRY_TO_LOCALE[country.toUpperCase()] ?? "en";
}
