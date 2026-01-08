import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { after, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

export default async function authProxy(request: NextRequest) {
	after(async () => {
		const logger = new Logger({ source: "middleware" });
		logger.info("Middleware request", { path: request.nextUrl.pathname });
	});

	if (request.nextUrl.pathname.includes("/dashboard")) {
		const sessionCookie = getSessionCookie(request);
		if (!sessionCookie) {
			const loginUrl = new URL("/login", request.url);
			loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
			return NextResponse.redirect(loginUrl);
		}
	}
	return handleI18nRouting(request);
}

export const config = {
	matcher: ["/((?!api|_next|.*\\..*).*)"],
};
