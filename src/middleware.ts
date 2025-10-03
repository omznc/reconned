import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { after, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import createMiddleware from "next-intl/middleware";
import { getLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";

const handleI18nRouting = createMiddleware(routing);

export default async function authMiddleware(request: NextRequest) {
	after(async () => {
		const logger = new Logger({ source: "middleware" });
		logger.middleware(request);
	});

	const resp = handleI18nRouting(request);
	if (request.nextUrl.pathname.includes("/dashboard")) {
		const resp = await fetch(`${env.NEXT_PUBLIC_BETTER_AUTH_URL}/api/auth/get-session`, {
			headers: await headers(),
		});

		const session = await resp.text();

		if (!session) {
			const locationHeader = resp.headers.get("Location");
			const locale = locationHeader ? new URL(locationHeader).pathname.split("/")[1] : await getLocale();

			return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
		}
	}
	return resp;
}

export const config = {
	matcher: ["/((?!api|_next|.*\\..*).*)"],
};
