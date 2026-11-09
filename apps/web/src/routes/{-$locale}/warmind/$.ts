import { createFileRoute } from "@tanstack/react-router";

const POSTHOG_API_HOST = "eu.i.posthog.com";
const POSTHOG_ASSETS_HOST = "eu-assets.i.posthog.com";
const DROPPED_REQUEST_HEADERS = ["host", "cookie", "connection", "content-length"];
const DROPPED_RESPONSE_HEADERS = ["content-encoding", "content-length", "transfer-encoding", "connection"];

/** Reverse proxy for PostHog, mounted at `/warmind` (`api_host` in `lib/consent.ts`) so ad blockers skip it. */
async function proxyToPosthog(request: Request, splat: string) {
	const url = new URL(request.url);
	const isAsset = splat === "static" || splat.startsWith("static/");
	const target = new URL(`/${splat}${url.search}`, `https://${isAsset ? POSTHOG_ASSETS_HOST : POSTHOG_API_HOST}`);

	const headers = new Headers(request.headers);
	for (const name of DROPPED_REQUEST_HEADERS) {
		headers.delete(name);
	}
	headers.set("host", target.host);

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
