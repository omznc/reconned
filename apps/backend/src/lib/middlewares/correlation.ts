import { randomUUIDv7 } from "bun";
import type { MiddlewareHandler } from "../router";

export function correlationMiddleware(): MiddlewareHandler {
	return async ({ context, next }) => {
		const requestId = randomUUIDv7();
		const startTime = Date.now();

		(context as unknown as Record<string, unknown>).requestId = requestId;
		(context as unknown as Record<string, unknown>).requestStartTime = startTime;

		const response = await next();

		const duration = Date.now() - startTime;

		const responseClone = new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});

		responseClone.headers.set("X-Request-ID", requestId);
		responseClone.headers.set("X-Response-Time", `${duration}ms`);

		return responseClone;
	};
}
