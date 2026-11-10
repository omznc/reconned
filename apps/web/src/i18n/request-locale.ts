import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getLocaleFromPathname, isLocale, type Locale } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

export const LOCALE_HEADER = "x-locale";
const SERVER_FN_PREFIX = "/_serverFn";

/**
 * The locale of the current request. On the server it comes from the request URL, or from the
 * `x-locale` header that the client sends with every server function call. On the client it comes
 * from `window.location`.
 */
export const getRequestLocale = createIsomorphicFn()
	.server((): Locale => {
		const request = getRequest();
		const { pathname } = new URL(request.url);
		if (pathname.startsWith(SERVER_FN_PREFIX)) {
			const header = request.headers.get(LOCALE_HEADER);
			return isLocale(header) ? header : routing.defaultLocale;
		}
		return getLocaleFromPathname(pathname);
	})
	.client((): Locale => getLocaleFromPathname(window.location.pathname));
