import { logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PostHog } from "posthog-node";

const POSTHOG_PUBLIC_KEY =
	process.env.NODE_ENV === "development" ? "" : "phc_dz8FuOeoRtR3dc1HCFZIaEVK1nRWAcDbPVc2oWkgicX";

export const posthog = new PostHog(POSTHOG_PUBLIC_KEY, {
	host: "https://eu.i.posthog.com",
});

const sdk = new NodeSDK({
	resource: resourceFromAttributes({
		"service.name": "reconned-backend",
	}),
	logRecordProcessor: new BatchLogRecordProcessor(
		new OTLPLogExporter({
			url: "https://us.i.posthog.com/i/v1/logs",
			headers: {
				Authorization: `Bearer ${POSTHOG_PUBLIC_KEY}`,
			},
		}),
	),
});

try {
	sdk.start();
} catch (error) {
	console.error("Failed to start OpenTelemetry logging SDK:", error);
}

export const logger = logs.getLogger("reconned-backend");
