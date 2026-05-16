import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { after, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import createMiddleware from "next-intl/middleware";
import { getDefaultLocaleFromCountry } from "@/i18n/country-locale";
import { routing } from "@/i18n/routing";

export default async function authProxy(request: NextRequest) {
	const { pathname } = request.nextUrl;
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

	const handleI18nRouting = createMiddleware({ ...routing, defaultLocale });
	after(async () => {
		const logger = new Logger({ source: "middleware" });
		logger.info("Middleware request", { path: request.nextUrl.pathname });
	});

	if (pathname.includes("/dashboard")) {
		const sessionCookie = getSessionCookie(request);
		if (!sessionCookie) {
			const loginUrl = new URL("/login", request.url);
			loginUrl.searchParams.set("redirectTo", pathname);
			return NextResponse.redirect(loginUrl);
		}
	}
	return handleI18nRouting(request);
}

export const config = {
	matcher: ["/((?!api|_next|.*\\..*).*)", "/.well-known/:path*", "/robots.txt"],
};
