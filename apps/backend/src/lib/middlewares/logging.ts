import { requestLoggingMiddleware } from "./index";

/**
 * Logging middleware that logs all requests
 * Uses the enhanced request logging middleware
 */
export const loggingMiddleware = requestLoggingMiddleware({
	logLevel: "info",
	excludePaths: ["/api/docs", "/api/openapi.json"],
});
