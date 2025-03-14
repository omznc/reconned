import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { auth } from "@/lib/auth";

const handleI18nRouting = createMiddleware(routing);

export default async function authMiddleware(request: NextRequest) {
	const resp = handleI18nRouting(request);
	if (request.nextUrl.pathname.includes("/dashboard")) {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session) {
			const locationHeader = resp.headers.get("Location");
			const locale = locationHeader
				? new URL(locationHeader).pathname.split("/")[1]
				: "en"; // Default to 'en' if not found

			return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
		}
	}
	return resp;
}

export const config = {
	matcher: ["/((?!api|_next|.*\\..*).*)"],
	runtime: "nodejs",
};
