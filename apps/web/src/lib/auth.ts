import { headers } from "next/headers";
import { cache } from "react";
import { authClient } from "@/lib/auth-client";

const sessionCache = new Map<string, { data: NonNullable<Awaited<ReturnType<typeof fetchSession>>>; expiry: number }>();
const CACHE_TTL = 5_000;
const MAX_CACHE_SIZE = 200;
let cacheWrites = 0;

function cleanupCache() {
	const now = Date.now();
	for (const [key, value] of sessionCache) {
		if (value.expiry <= now) {
			sessionCache.delete(key);
		}
	}
}

function getSessionToken(cookie: string): string | null {
	const match = cookie.match(/(?:__Secure-)?better-auth\.session_token=([^;]+)/);
	return match?.[1] || null;
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

export const isAuthenticated = cache(async () => {
	const headersList = await headers();
	const cookie = headersList.get("cookie") || "";
	const sessionToken = getSessionToken(cookie);

	if (sessionToken) {
		const cached = sessionCache.get(sessionToken);
		if (cached && cached.expiry > Date.now()) {
			return cached.data;
		}
		sessionCache.delete(sessionToken);
	}

	if (!sessionToken) {
		return null;
	}

	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const data = await fetchSession(headersList);

			if (data && sessionToken) {
				cacheWrites++;
				if (cacheWrites >= 100) {
					cleanupCache();
					cacheWrites = 0;
				}
				if (sessionCache.size < MAX_CACHE_SIZE) {
					sessionCache.set(sessionToken, { data, expiry: Date.now() + CACHE_TTL });
				}
			}

			return data;
		} catch {
			if (attempt === 1) {
				return null;
			}
			await new Promise((r) => setTimeout(r, 500));
		}
	}

	return null;
});
