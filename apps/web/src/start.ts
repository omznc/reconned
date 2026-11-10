import { createMiddleware, createStart } from "@tanstack/react-start";
import { getLocaleFromPathname } from "@/i18n/messages";
import { LOCALE_HEADER } from "@/i18n/request-locale";
import { handleEdgeRequest } from "@/server/request-middleware";

const edgeMiddleware = createMiddleware().server(async ({ request, next }) => {
	const edge = await handleEdgeRequest(request);
	if (edge.response) {
		return edge.response;
	}
	const result = await next();
	edge.decorate?.(result.response);
	markPrivate(request, result.response);
	return result;
});

/**
 * Pages and server function results can hold the signed-in user, and a shared cache keys on the
 * URL only. Same header the Next.js app sent on every page.
 */
function markPrivate(request: Request, response: Response) {
	const isServerFn = new URL(request.url).pathname.startsWith("/_serverFn");
	const isHtml = response.headers.get("content-type")?.startsWith("text/html") ?? false;
	if ((isServerFn || isHtml) && !response.headers.has("cache-control")) {
		response.headers.set("cache-control", "private, no-cache, no-store, max-age=0, must-revalidate");
	}
}

// Server functions are POSTed to /_serverFn, so the page locale has to travel in a header.
const localeFunctionMiddleware = createMiddleware({ type: "function" }).client(async ({ next }) => {
	// Server functions called during SSR run this too, but there the request itself carries the locale.
	if (typeof window === "undefined") {
		return await next();
	}
	return await next({ headers: { [LOCALE_HEADER]: getLocaleFromPathname(window.location.pathname) } });
});

export const startInstance = createStart(() => ({
	requestMiddleware: [edgeMiddleware],
	functionMiddleware: [localeFunctionMiddleware],
}));
