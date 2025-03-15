import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { headers } from "next/headers";
import { LANGUAGE_MAPS } from "@/i18n/valid-locales";

export default getRequestConfig(async ({ requestLocale }) => {
	const cfCountry = (await headers()).get("cf-ipcountry");
	let resolvedLocale = await requestLocale;

	if (cfCountry) {
		for (const [locale, countries] of Object.entries(LANGUAGE_MAPS)) {
			if (countries.includes(cfCountry.toLowerCase())) {
				resolvedLocale = locale;
				break;
			}
		}
	}

	const requested = resolvedLocale;
	const locale = hasLocale(routing.locales, requested)
		? requested
		: routing.defaultLocale;

	return {
		locale,
		messages: (await import(`@/../messages/${locale}.json`)).default,
	};
});
