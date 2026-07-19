import { cookies, headers } from "next/headers";
import { cache } from "react";
import { authClient } from "@/lib/auth-client";

const SESSION_COOKIE_NAMES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

async function hasSessionCookie(): Promise<boolean> {
	const cookieStore = await cookies();
	return SESSION_COOKIE_NAMES.some((name) => Boolean(cookieStore.get(name)?.value));
}

async function fetchSession(requestHeaders: Headers) {
	const result = await authClient.getSession({
		fetchOptions: {
			headers: requestHeaders,
			cache: "no-store",
		},
	});

	if (!result.data?.user?.id) {
		return null;
	}

	return {
		...result.data.user,
		session: result.data.session,
	};
}

/**
 * Reads the current session.
 *
 * Deduplicated per-request via React `cache()` — the layout and the page both
 * call this within a single render, and this collapses that to one backend call.
 *
 * Deliberately NOT cached across requests: a module-level cache would keep a
 * revoked or banned user authenticated in SSR, and serving a *stale* session
 * when the backend is unreachable is worse still. On failure we fail closed and
 * report the request as unauthenticated.
 */
export const isAuthenticated = cache(async () => {
	if (!(await hasSessionCookie())) {
		return null;
	}

	const headersList = await headers();

	try {
		return await fetchSession(headersList);
	} catch {
		// One quick retry to absorb a single transient blip. The backend keeps a
		// session cookie cache, so this is cheap — but we must not turn a degraded
		// backend into seconds of added TTFB on every page.
		try {
			return await fetchSession(headersList);
		} catch {
			// Fail closed. Never serve a stale session.
			return null;
		}
	}
});
