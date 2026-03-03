import { cookies, headers } from "next/headers";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { getDefaultLocaleFromCountry } from "@/i18n/country-locale";
import { routing } from "@/i18n/routing";

export default getRequestConfig(async ({ requestLocale }) => {
	const allHeaders = await headers();
	const allCookies = await cookies();

	const cookieLocale = allCookies.get("NEXT_LOCALE")?.value;
	const country = allHeaders.get("CF-IPCountry");
	const defaultLanguage = getDefaultLocaleFromCountry(country);

	const resolvedLocale = await requestLocale;

	// Check cookie first, then URL locale, then country-based default, then fallback
	let locale: string;
	if (cookieLocale && hasLocale(routing.locales, cookieLocale)) {
		locale = cookieLocale;
	} else if (hasLocale(routing.locales, resolvedLocale)) {
		locale = resolvedLocale;
	} else {
		locale = defaultLanguage;
	}

	return {
		locale,
		messages: (await import(`@/../messages/${locale}.json`)).default,
	};
});
