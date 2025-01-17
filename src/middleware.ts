import { env } from "@/lib/env";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export default async function authMiddleware(request: NextRequest) {
	const response = await fetch(
		process.env.NODE_ENV === "development"
			? `${request.nextUrl.origin}/api/auth/get-session`
			: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/api/auth/get-session`,
		{
			headers: await headers(),
		},
	);
	const data = await response.json();

	if (!data?.session) {
		return NextResponse.redirect(new URL("/login", request.url));
	}
	return NextResponse.next();
}

export const config = {
	matcher: ["/dashboard/:path"],
};
