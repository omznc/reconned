import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

export default getRequestConfig(async ({ requestLocale }) => {
	const resolvedLocale = await requestLocale;
	const locale = hasLocale(routing.locales, resolvedLocale) ? resolvedLocale : routing.defaultLocale;

	return {
		locale,
		messages: (await import(`@/../messages/${locale}.json`)).default,
	};
});
