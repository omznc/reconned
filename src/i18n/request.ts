import "server-only";
import { LANGUAGE_MAPS, VALID_LOCALES } from "@/i18n/valid-locales";
import { isAuthenticated } from "@/lib/auth";
import { getRequestConfig } from "next-intl/server";
import { headers, cookies } from "next/headers";
import deepmerge from "deepmerge";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

export default getRequestConfig(async () => {
	const [userCached, headersList, cookieStore] = await Promise.all([
		isAuthenticated(),
		headers(),
		cookies(),
	]);

	let user: { language: string } | null = null;

	if (userCached) {
		user = await prisma.user.findUnique({
			where: { id: userCached.id },
			select: { language: true },
		});
	}

	const cookieLocale = cookieStore.get("preferred-language")?.value;
	const cloudflareCountry =
		headersList.get("cf-ipcountry")?.toLowerCase() ?? "ba";

	let lang = "bs";

	// First check cookies
	// biome-ignore lint/suspicious/noExplicitAny: It's not typed.
	if (cookieLocale && VALID_LOCALES.includes(cookieLocale as any)) {
		lang = cookieLocale;
	} else {
		// Then check Cloudflare country
		for (const [locale, countries] of Object.entries(LANGUAGE_MAPS)) {
			if (countries.includes(cloudflareCountry as never)) {
				lang = locale;
				break;
			}
		}
	}

	const defaultMessages = (await import("../messages/bs.json")).default;

	// If the user is logged in, they have a locale
	if (user?.language && VALID_LOCALES.includes(user.language as never)) {
		return {
			locale: user.language,
			messages: deepmerge(
				defaultMessages,
				(await import(`../messages/${user.language}.json`)).default,
			),
		};
	}

	// Use the language we determined from cookies or Cloudflare
	if (VALID_LOCALES.includes(lang as never)) {
		return {
			locale: lang,
			messages: deepmerge(
				defaultMessages,
				(await import(`../messages/${lang}.json`)).default,
			),
		};
	}

	// Default to bosnian
	return {
		locale: "bs",
		messages: defaultMessages,
	};
});
