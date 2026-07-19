import { BASE_URL, testEnv } from "./env";

export interface ApiResponse {
	status: number;
	// biome-ignore lint/suspicious/noExplicitAny: test assertion payloads are inherently untyped
	body: any;
	headers: Headers;
}

async function request(
	method: string,
	path: string,
	options: { cookie?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<ApiResponse> {
	const response = await fetch(`${BASE_URL}${path}`, {
		method,
		headers: {
			"content-type": "application/json",
			// The full suite fires thousands of requests from one IP inside the rate-limit window,
			// so use the same internal-secret bypass the SSR layer relies on (see rateLimitKey in
			// src/index.ts). No test asserts the global limiter.
			"x-internal-api-secret": testEnv.INTERNAL_API_SECRET ?? "",
			...(options.cookie ? { cookie: options.cookie } : {}),
			...options.headers,
		},
		body: options.body === undefined ? undefined : JSON.stringify(options.body),
	});
	return {
		status: response.status,
		body: await response.json().catch(() => null),
		headers: response.headers,
	};
}

/** Thin fetch wrapper bound to an optional session cookie. Paths are absolute (e.g. "/api/clubs"). */
export function api(cookie?: string) {
	return {
		get: (path: string, headers?: Record<string, string>) => request("GET", path, { cookie, headers }),
		post: (path: string, body?: unknown, headers?: Record<string, string>) =>
			request("POST", path, { cookie, body, headers }),
		patch: (path: string, body?: unknown, headers?: Record<string, string>) =>
			request("PATCH", path, { cookie, body, headers }),
		put: (path: string, body?: unknown, headers?: Record<string, string>) =>
			request("PUT", path, { cookie, body, headers }),
		delete: (path: string, headers?: Record<string, string>) => request("DELETE", path, { cookie, headers }),
	};
}
