import "server-only";
import { VALID_LOCALES } from "@/i18n/valid-locales";
import { isAuthenticated } from "@/lib/auth";
import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import deepmerge from "deepmerge";

const languageMaps = {
	bs: ["ba", "hr", "sr"],
	en: ["en", "us", "gb", "au", "ca", "nz", "ie", "za"],
};

export default getRequestConfig(async () => {
	const [user, headersList] = await Promise.all([isAuthenticated(), headers()]);

	// We get this from Cloudflare
	const cloudflareCountry =
		headersList.get("cf-ipcountry")?.toLowerCase() ?? "ba";
	let lang = "bs";
	for (const [locale, countries] of Object.entries(languageMaps)) {
		if (countries.includes(cloudflareCountry)) {
			lang = locale;
			break;
		}
	}
	const defaultMessages = (await import("../messages/bs.json")).default;

	// If the user is logged in, they have a locale
	if (user?.language) {
		if (VALID_LOCALES.includes(user.language)) {
			return {
				locale: user.language,
				messages: deepmerge(
					defaultMessages,
					(await import(`../messages/${user.language}.json`)).default,
				),
			};
		}

		// If the user has an invalid locale, check if the request has a valid locale
		if (VALID_LOCALES.includes(lang)) {
			return {
				locale: lang,
				messages: deepmerge(
					defaultMessages,
					(await import(`../messages/${lang}.json`)).default,
				),
			};
		}
	}

	// Otherwise, check if the request has a valid locale
	if (VALID_LOCALES.includes(lang)) {
		return {
			locale: lang,
			messages: deepmerge(
				defaultMessages,
				(await import(`../messages/${lang}.json`)).default,
			),
		};
	}

	// Default to bosnian
	// Should this be english eventually?
	return {
		locale: "bs",
		messages: defaultMessages,
	};
});
