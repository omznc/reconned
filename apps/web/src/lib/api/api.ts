import "server-only";

import { headers } from "next/headers";
import createClient from "openapi-fetch";
import { env } from "../env";
import type { paths } from "./api-types";

type ApiPaths = paths & {
	[K in keyof paths as K extends string ? `/api${K}` : never]: paths[K];
};

type NextFetchOptions = {
	next?: {
		revalidate?: number | false;
		tags?: string[];
	};
	cache?: RequestInit["cache"];
};

// Normalize backend base URL: strip trailing slashes only; keep explicit /api suffix if provided.
const backendBaseUrl = (() => {
	const raw = env.NEXT_PUBLIC_BACKEND_URL?.trim();
	if (!raw) return undefined;

	return raw.replace(/\/+$/, "");
})();

const apiServer = createClient<ApiPaths>({
	baseUrl: backendBaseUrl,
	credentials: "include",
	fetch: (async (request: Request, init?: RequestInit) => {
		// Forward Next.js caching options (next.revalidate, next.tags, cache)
		// openapi-fetch copies user init options onto the Request object
		// but Next.js's augmented fetch only reads them from the 2nd arg (init).
		const nextOptions: NextFetchOptions = {};
		const req = request as Request & NextFetchOptions;
		if (req.next) {
			nextOptions.next = req.next;
		}

		const requestHeaders = new Headers();

		// Add internal API secret header for rate limit bypass
		if (env.INTERNAL_API_SECRET) {
			requestHeaders.set("x-internal-api-secret", env.INTERNAL_API_SECRET);
		}

		// A caller that sets `next.revalidate` is declaring the response shared and cacheable. Such
		// a request is sent with no request-derived headers at all, for two reasons:
		//
		// 1. Correctness/security: the response lands in Next's *shared* Data Cache, so forwarding
		//    the caller's cookies would let one user's authenticated payload be replayed to every
		//    other visitor. Every `next.revalidate` call site targets a public endpoint.
		// 2. Static rendering: reading `headers()` at all opts the calling route out of static
		//    generation, so skipping it is what lets these pages prerender at build time.
		if (!nextOptions.next?.revalidate) {
			const incoming = await headers();

			// Allowlist rather than a blanket copy of the incoming headers: forwarding hop-by-hop
			// and body-framing headers (`host`, `content-length`, `connection`) to a different
			// origin is wrong and has no upside.
			for (const name of ["cookie", "authorization", "accept-language", "user-agent"]) {
				const value = incoming.get(name);
				if (value) {
					requestHeaders.set(name, value);
				}
			}
		}

		try {
			return await fetch(request, {
				...init,
				...nextOptions,
				headers: requestHeaders,
			});
		} catch (error) {
			// A connection-level failure (backend down, DNS, timeout) throws instead of
			// returning `{ error }`, and an unhandled throw during prerendering aborts the
			// whole `next build`. Surface it as a synthetic 503 so every call site's
			// existing `{ error }` handling applies. Client aborts stay thrown — they are
			// control flow, not backend failures.
			if (error instanceof DOMException && error.name === "AbortError") {
				throw error;
			}
			console.error(`Backend unreachable: ${request.method} ${request.url}`, error);
			return new Response(JSON.stringify({ message: "Backend unreachable" }), {
				status: 503,
				headers: { "content-type": "application/json" },
			});
		}
	}) as (input: Request) => Promise<Response>,
});

export default apiServer;
