import "server-only";

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

// Public API client for use in contexts where headers() is not available (e.g., OG image generation)
const apiPublic = createClient<ApiPaths>({
	baseUrl: backendBaseUrl,
	credentials: "include",
	fetch: async (request) => {
		const requestHeaders = new Headers();

		// Add internal API secret header for rate limit bypass
		if (env.INTERNAL_API_SECRET) {
			requestHeaders.set("x-internal-api-secret", env.INTERNAL_API_SECRET);
		}

		return fetch(request, {
			headers: requestHeaders,
		});
	},
});

export default apiPublic;
