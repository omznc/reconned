import { createLogAttributes, type LogAttributes, logger } from "../posthog";
import type { MiddlewareHandler } from "../router";

export function wideEventsMiddleware(): MiddlewareHandler {
	return async ({ context, next }) => {
		const startTime = Date.now();
		const url = new URL(context.request.url);

		const wideEvent: LogAttributes = createLogAttributes({
			request: {
				id: context.requestId,
				method: context.request.method,
				path: url.pathname,
				user_agent: context.request.headers.get("user-agent") || undefined,
				ip:
					context.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
					context.request.headers.get("x-real-ip") ||
					context.request.headers.get("cf-connecting-ip") ||
					undefined,
			},
			...(context.user && {
				user: {
					id: context.user.id,
					email: context.user.email,
					role: context.user.role,
				},
			}),
			business: context.businessContext || {},
		});

		try {
			const response = await next();

			wideEvent.status_code = response.status;
			wideEvent.outcome = "success";
			wideEvent.duration_ms = Date.now() - startTime;

			logger.emit({
				severityText: "info",
				body: `${context.request.method} ${url.pathname}`,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				attributes: wideEvent as any,
			});

			return response;
		} catch (error) {
			wideEvent.status_code = 500;
			wideEvent.outcome = "error";
			wideEvent.error = {
				message: error instanceof Error ? error.message : String(error),
				type: error instanceof Error ? error.name : "Unknown",
				stack: error instanceof Error ? error.stack : undefined,
			};
			wideEvent.duration_ms = Date.now() - startTime;

			logger.emit({
				severityText: "error",
				body: `Request failed: ${context.request.method} ${url.pathname}`,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				attributes: wideEvent as any,
			});

			throw error;
		}
	};
}

export function addBusinessContext(context: Record<string, unknown>, data: Record<string, unknown>): void {
	if (!context.businessContext) {
		(context as Record<string, unknown>).businessContext = {};
	}
	const businessContext = (context as Record<string, unknown>).businessContext as Record<string, unknown>;
	Object.assign(businessContext, data);
}
