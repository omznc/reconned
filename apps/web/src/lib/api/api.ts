import "server-only";

import { headers } from "next/headers";
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

const apiServer = createClient<ApiPaths>({
	baseUrl: backendBaseUrl,
	credentials: "include",
	fetch: async (request) => {
		const headersList = await headers();
		const requestHeaders = new Headers(headersList);

		// Add internal API secret header for rate limit bypass
		if (env.INTERNAL_API_SECRET) {
			requestHeaders.set("x-internal-api-secret", env.INTERNAL_API_SECRET);
		}

		return fetch(request, {
			headers: requestHeaders,
		});
	},
});

export default apiServer;
