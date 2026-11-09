import "server-only";

import { getCookie, getRequestHeaders } from "@tanstack/react-start/server";
import { authClient } from "@/lib/auth-client";

const SESSION_COOKIE_NAMES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

function hasSessionCookie(): boolean {
	return SESSION_COOKIE_NAMES.some((name) => Boolean(getCookie(name)));
}

async function fetchSession(requestHeaders: Headers) {
	const result = await authClient.getSession({
		// The renewed session cookie from a refresh would stop here, never reach the browser, and the
		// browser cookie would expire `expiresIn` after sign-in. The browser's own `useSession` refreshes.
		query: { disableRefresh: true },
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
 * Reads the current session. Server-only: call it inside `createServerFn` handlers.
 *
 * Not deduplicated across calls. The `{-$locale}` route runs it once in `beforeLoad` and passes
 * the user down through route context, so child routes read `context.user` instead.
 *
 * Deliberately NOT cached across requests: a module-level cache would keep a
 * revoked or banned user authenticated in SSR, and serving a *stale* session
 * when the backend is unreachable is worse still. On failure we fail closed and
 * report the request as unauthenticated.
 */
export async function isAuthenticated() {
	if (!hasSessionCookie()) {
		return null;
	}

	const headersList = getRequestHeaders();

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
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof isAuthenticated>>>;
