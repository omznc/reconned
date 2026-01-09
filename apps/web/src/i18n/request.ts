import { cookies, headers } from "next/headers";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "@/i18n/routing";

const DEFAULT_LANGUAGES: Record<(typeof routing.locales)[number], string[]> = {
	bs: ["BA", "HR"],
	sr: ["RS"],
	en: [], // Default language is English
};

export default getRequestConfig(async ({ requestLocale }) => {
	const allHeaders = await headers();
	const allCookies = await cookies();

	// Priority: Cookie > URL > Country > Default
	const cookieLocale = allCookies.get("NEXT_LOCALE")?.value;
	const country = allHeaders.get("CF-IPCountry")?.toUpperCase();
	const defaultLanguage = Object.entries(DEFAULT_LANGUAGES).find(([_, countries]) =>
		countries.includes(country || ""),
	)?.[0];

	const resolvedLocale = await requestLocale;

	// Check cookie first, then URL locale, then country-based default, then fallback
	let locale: string;
	if (cookieLocale && hasLocale(routing.locales, cookieLocale)) {
		locale = cookieLocale;
	} else if (hasLocale(routing.locales, resolvedLocale)) {
		locale = resolvedLocale;
	} else {
		locale = defaultLanguage || routing.defaultLocale;
	}

	return {
		locale,
		messages: (await import(`@/../messages/${locale}.json`)).default,
	};
});
