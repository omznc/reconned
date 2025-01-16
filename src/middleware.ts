import { auth } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";
import { env } from "@/lib/env";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export default async function authMiddleware(request: NextRequest) {
	const session = await authClient.getSession(undefined, {
		headers: await headers(),
	});

	console.log("session", session);

	if (!session) {
		return NextResponse.redirect(new URL("/login", request.url));
	}
	return NextResponse.next();
}

export const config = {
	matcher: ["/dashboard/:path*"],
};
