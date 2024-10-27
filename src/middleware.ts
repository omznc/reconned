import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export default async function authMiddleware(request: NextRequest) {
	const response = await fetch(
		`${request.nextUrl.origin}/api/auth/get-session`,
		{
			headers: {
				cookie: request.headers.get("cookie") || "",
			},
		},
	);
	const data = await response.json();

	if (!data.session) {
		return NextResponse.redirect(new URL("/login", request.url));
	}
	return NextResponse.next();
}

export const config = {
	matcher: ["/dashboard/:path*"],
};
