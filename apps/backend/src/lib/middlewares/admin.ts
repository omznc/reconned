import type { MiddlewareHandler } from "@reconned/router";

/**
 * Admin authorization middleware
 */
export const adminMiddleware: MiddlewareHandler = async ({ context, next }) => {
	if (!context.isAdmin) {
		return context.response.error({ error: "Unauthorized" }, 401);
	}
	return next();
};
