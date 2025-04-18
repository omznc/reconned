import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { getLocale } from "next-intl/server";
import { env } from "@/lib/env";
import { headers } from "next/headers";

const handleI18nRouting = createMiddleware(routing);

export default async function authMiddleware(request: NextRequest) {
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
