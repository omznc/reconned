import { routing } from "./routing";

const COUNTRY_TO_LOCALE: Record<string, (typeof routing.locales)[number]> = {
	BA: "bs",
	HR: "bs",
	RS: "sr",
};

export function getDefaultLocaleFromCountry(country: string | null): (typeof routing.locales)[number] {
	if (!country) {
		return routing.defaultLocale;
	}
	return COUNTRY_TO_LOCALE[country.toUpperCase()] ?? routing.defaultLocale;
}
