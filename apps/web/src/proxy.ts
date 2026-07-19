import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { getDefaultLocaleFromCountry } from "@/i18n/country-locale";
import { routing } from "@/i18n/routing";

/**
 * next-intl middlewares, memoized per resolved default locale.
 *
 * `defaultLocale` varies by `CF-IPCountry`, so we can't build a single instance,
 * but there is one instance per locale rather than one per request.
 */
const i18nMiddlewares = new Map<string, ReturnType<typeof createMiddleware>>();

/** The only `/.well-known/` paths better-auth serves, and so the only ones worth proxying. */
const OAUTH_DISCOVERY_PREFIXES = ["/.well-known/oauth-authorization-server", "/.well-known/oauth-protected-resource"];

function getI18nMiddleware(defaultLocale: (typeof routing.locales)[number]) {
	let middleware = i18nMiddlewares.get(defaultLocale);
	if (!middleware) {
		middleware = createMiddleware({ ...routing, defaultLocale });
		i18nMiddlewares.set(defaultLocale, middleware);
	}
	return middleware;
}

function isDashboardPath(pathname: string): boolean {
	// Segment match, not a substring match: `/dashboard`, `/dashboard/...`,
	// `/en/dashboard`, `/en/dashboard/...` — but not `/clubs/my-dashboard`.
	const segments = pathname.split("/").filter(Boolean);
	if (segments[0] === "dashboard") {
		return true;
	}
	return routing.locales.includes(segments[0] as (typeof routing.locales)[number]) && segments[1] === "dashboard";
}

export default async function authProxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Proxy well-known metadata (OAuth discovery for MCP server) to the backend.
	// Must fetch manually — NextResponse.rewrite with our own origin does an
	// internal rewrite instead of proxying, and Rewrite with an external origin
	// would break in Docker.
	//
	// Scoped to the two OAuth prefixes rather than all of `/.well-known/`: middleware runs before
	// route handlers, so a catch-all here shadowed `app/.well-known/api-catalog/route.ts` entirely
	// and forwarded it to `/api/auth/.well-known/api-catalog`, which better-auth does not serve —
	// the catalog answered 404 in production.
	if (OAUTH_DISCOVERY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
		const backendUrl =
			process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002";
		const target = new URL(`/api/auth${pathname}`, backendUrl);
		const proxy = await fetch(target);
		return new Response(await proxy.text(), {
			status: proxy.status,
			headers: proxy.headers,
		});
	}

	// Other `/.well-known/` paths (api-catalog, mcp/server-card.json) are served by
	// route handlers — locale negotiation below would rewrite them into `[locale]`
	// and answer with the HTML 404 page.
	if (pathname.startsWith("/.well-known/")) {
		return NextResponse.next();
	}

	const country = request.headers.get("CF-IPCountry");
	const defaultLocale = getDefaultLocaleFromCountry(country);
	const hasLocalePrefix = routing.locales.some(
		(locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
	);
	if (pathname.includes("opengraph-image")) {
		if (!hasLocalePrefix) {
			const rewriteUrl = request.nextUrl.clone();
			rewriteUrl.pathname = `/${defaultLocale}${pathname}`;
			return NextResponse.rewrite(rewriteUrl);
		}
		return NextResponse.next();
	}

	if (isDashboardPath(pathname)) {
		// Cookie-presence check only — an optimization to avoid rendering the
		// dashboard shell for obviously-anonymous requests. Pages re-verify the
		// session server-side, so this must never become an HTTP call.
		const sessionCookie = getSessionCookie(request);
		if (!sessionCookie) {
			const loginUrl = new URL("/login", request.url);
			loginUrl.searchParams.set("redirectTo", pathname);
			return NextResponse.redirect(loginUrl);
		}
	}

	// Handles locale negotiation: `NEXT_LOCALE` cookie first, then
	// `Accept-Language`, then the country-derived `defaultLocale` above.
	return getI18nMiddleware(defaultLocale)(request);
}

export const config = {
	matcher: ["/((?!api|_next|.*\\..*).*)", "/.well-known/:path*"],
};
