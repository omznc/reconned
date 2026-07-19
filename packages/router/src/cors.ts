/**
 * CORS utilities for handling Cross-Origin Resource Sharing
 */

import { setHeaders } from "./router";

/**
 * Handle CORS preflight requests
 * Returns a response for OPTIONS requests, null otherwise
 */
export function handleCORS(request: Request, allowedOrigins: string[]): Response | null {
	const origin = request.headers.get("origin");

	if (request.method === "OPTIONS") {
		const headers: Record<string, string> = {
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization, X-Captcha-Response",
			"Access-Control-Allow-Credentials": "true",
		};

		if (origin && allowedOrigins.includes(origin)) {
			headers["Access-Control-Allow-Origin"] = origin;
		}

		return new Response(null, { status: 204, headers });
	}

	return null;
}

/**
 * Add CORS headers to a response.
 * Headers are set in place; responses with immutable headers are rebuilt instead.
 */
export function addCORSHeaders(response: Response, request: Request, allowedOrigins: string[]): Response {
	const origin = request.headers.get("origin");

	if (origin && allowedOrigins.includes(origin)) {
		return setHeaders(response, [
			["Access-Control-Allow-Origin", origin],
			["Access-Control-Allow-Credentials", "true"],
		]);
	}

	return response;
}
