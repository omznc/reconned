import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "@/i18n/routing";

/**
 * Resolves the locale purely from the route segment (`requestLocale`).
 *
 * Deliberately does NOT read `headers()` or `cookies()`: doing so opts every
 * route in the app out of static rendering, which made every `export const
 * revalidate` and `generateStaticParams()` dead code.
 *
 * Cookie (`NEXT_LOCALE`), `Accept-Language` and geo (`CF-IPCountry`) based
 * detection all still happen — in `src/proxy.ts` (the middleware), which is the
 * correct layer for it: it runs before routing and can redirect/rewrite to the
 * locale-prefixed path, so by the time we get here the URL already encodes the
 * negotiated locale.
 */
export default getRequestConfig(async ({ requestLocale }) => {
	const requested = await requestLocale;
	const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

	return {
		locale,
		messages: (await import(`@/../messages/${locale}.json`)).default,
	};
});
