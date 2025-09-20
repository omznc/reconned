import { headers } from "next/headers";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "@/i18n/routing";

const DEFAULT_LANGUAGES: Record<(typeof routing.locales)[number], string[]> = {
	bs: ["BS", "RS", "HR"],
	en: [], // Default language is English
};

export default getRequestConfig(async ({ requestLocale }) => {
	const allHeaders = await headers();
	const country = allHeaders.get("cf-ipcountry");
	const defaultLanguage = Object.entries(DEFAULT_LANGUAGES).find(([_, countries]) =>
		countries.includes(country as string),
	)?.[0];

	const resolvedLocale = await requestLocale;
	const locale = hasLocale(routing.locales, resolvedLocale)
		? resolvedLocale
		: (defaultLanguage ?? routing.defaultLocale);

	return {
		locale,
		messages: (await import(`@/../messages/${locale}.json`)).default,
	};
});
