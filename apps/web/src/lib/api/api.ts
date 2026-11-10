import "server-only";

import { getRequestHeaders } from "@tanstack/react-start/server";
import createClient from "openapi-fetch";
import { env } from "../env";
import type { paths } from "./api-types";

type ApiPaths = paths & {
	[K in keyof paths as K extends string ? `/api${K}` : never]: paths[K];
};

// Normalize backend base URL: strip trailing slashes only; keep explicit /api suffix if provided.
const backendBaseUrl = (() => {
	const raw = env.NEXT_PUBLIC_BACKEND_URL?.trim();
	if (!raw) return undefined;

	return raw.replace(/\/+$/, "");
})();

/**
 * Server-side API client. Call it only inside `createServerFn` handlers, API routes or middleware:
 * it reads the incoming request and forwards the caller's session cookie to the backend.
 */
const apiServer = createClient<ApiPaths>({
	baseUrl: backendBaseUrl,
	credentials: "include",
	fetch: (async (request: Request, init?: RequestInit) => {
		const requestHeaders = new Headers();

		// Add internal API secret header for rate limit bypass
		if (env.INTERNAL_API_SECRET) {
			requestHeaders.set("x-internal-api-secret", env.INTERNAL_API_SECRET);
		}

		const incoming = getRequestHeaders();

		// Allowlist rather than a blanket copy of the incoming headers: forwarding hop-by-hop
		// and body-framing headers (`host`, `content-length`, `connection`) to a different
		// origin is wrong and has no upside.
		for (const name of ["cookie", "authorization", "accept-language", "user-agent"]) {
			const value = incoming.get(name);
			if (value) {
				requestHeaders.set(name, value);
			}
		}

		try {
			return await fetch(request, {
				...init,
				headers: requestHeaders,
			});
		} catch (error) {
			// A connection-level failure (backend down, DNS, timeout) throws instead of
			// returning `{ error }`. Surface it as a synthetic 503 so every call site's
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
