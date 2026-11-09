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
	return result;
});

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
