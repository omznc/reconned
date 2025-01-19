import { isAuthenticated } from "@/lib/auth";
import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";

export const VALID_LOCALES = ["bs"];

export default getRequestConfig(async () => {
	const [user, headersList] = await Promise.all([isAuthenticated(), headers()]);

	// We get this from Cloudflare
	const country = headersList.get("cf-ipcountry")?.toLowerCase() ?? "bs";

	// If the user is logged in, they have a locale
	if (user?.language) {
		if (VALID_LOCALES.includes(user.language)) {
			return {
				locale: user.language,
				messages: (await import(`../messages/${user.language}.json`)).default,
			};
		}

		// If the user has an invalid locale, check if the request has a valid locale
		if (VALID_LOCALES.includes(country)) {
			return {
				locale: country,
				messages: (await import(`../messages/${country}.json`)).default,
			};
		}
	}

	// Otherwise, check if the request has a valid locale
	if (VALID_LOCALES.includes(country)) {
		return {
			locale: country,
			messages: (await import(`../messages/${country}.json`)).default,
		};
	}

	// Default to bs
	return {
		locale: "bs",
		messages: (await import("../messages/bs.json")).default,
	};
});
