import { requestLoggingMiddleware } from "@reconned/router";
import { loggingConfig, shouldSampleLog } from "../logging-config";
import { logger } from "../posthog";

export const loggingMiddleware = requestLoggingMiddleware({
	log: (level, message, data) => {
		if (!loggingConfig.enabled || !shouldSampleLog()) {
			return;
		}
		logger.emit({
			severityText: level === "error" ? "error" : "info",
			body: message,
			attributes: data as unknown as Record<string, never>,
		});
	},
	excludePaths: ["/api/docs", "/api/openapi.json"],
});
