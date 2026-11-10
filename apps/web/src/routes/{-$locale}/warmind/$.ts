import { createFileRoute } from "@tanstack/react-router";

import { buildPosthogTarget, posthogRequestHeaders } from "@/lib/server/posthog-proxy";

const DROPPED_RESPONSE_HEADERS = ["content-encoding", "content-length", "transfer-encoding", "connection"];

/** Reverse proxy for PostHog, mounted at `/warmind` (`api_host` in `lib/consent.ts`) so ad blockers skip it. */
async function proxyToPosthog(request: Request, splat: string) {
	const url = new URL(request.url);
	const target = buildPosthogTarget(splat, url.search);
	if (!target) {
		return new Response("Not Found", { status: 404 });
	}
	const headers = posthogRequestHeaders(request.headers, target);

	const hasBody = request.method !== "GET" && request.method !== "HEAD";
	const upstream = await fetch(target, {
		method: request.method,
		headers,
		body: hasBody ? await request.arrayBuffer() : undefined,
		redirect: "manual",
	});

	const responseHeaders = new Headers(upstream.headers);
	for (const name of DROPPED_RESPONSE_HEADERS) {
		responseHeaders.delete(name);
	}
	return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const Route = createFileRoute("/{-$locale}/warmind/$")({
	server: {
		handlers: {
			GET: ({ request, params }) => proxyToPosthog(request, params._splat ?? ""),
			POST: ({ request, params }) => proxyToPosthog(request, params._splat ?? ""),
			OPTIONS: ({ request, params }) => proxyToPosthog(request, params._splat ?? ""),
		},
	},
});
