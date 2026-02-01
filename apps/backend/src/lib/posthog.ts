import { logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PostHog } from "posthog-node";
import packageJson from "../../package.json";

const POSTHOG_PUBLIC_KEY =
	process.env.NODE_ENV === "development" ? "" : "phc_dz8FuOeoRtR3dc1HCFZIaEVK1nRWAcDbPVc2oWkgicX";

export const posthog = new PostHog(POSTHOG_PUBLIC_KEY, {
	host: "https://eu.i.posthog.com",
});

const SERVICE_VERSION = packageJson.version;
const GIT_COMMIT = process.env.GIT_COMMIT || "unknown";
const ENVIRONMENT = process.env.NODE_ENV || "development";

const sdk = new NodeSDK({
	resource: resourceFromAttributes({
		"service.name": "reconned-backend",
		"service.version": SERVICE_VERSION,
		"service.commit_hash": GIT_COMMIT,
		"deployment.environment": ENVIRONMENT,
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

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ServiceContext {
	name: string;
	version: string;
	commit_hash: string;
	environment: string;
}

export interface RequestContext {
	id: string;
	method: string;
	path: string;
	user_agent?: string;
	ip?: string;
}

export interface UserContext {
	id: string;
	email?: string;
	subscription_tier?: string;
	role?: string;
}

export interface ErrorContext {
	message: string;
	type: string;
	stack?: string;
	code?: string;
}

export interface BusinessContext {
	[key: string]: unknown;
}

export interface LogAttributes {
	service: ServiceContext;
	request?: RequestContext;
	user?: UserContext;
	error?: ErrorContext;
	business?: BusinessContext;
	duration_ms?: number;
	status_code?: number;
	outcome?: "success" | "error";
	[key: string]: unknown;
}

export function createLogAttributes(baseAttributes: Partial<LogAttributes> = {}): LogAttributes {
	return {
		service: {
			name: "reconned-backend",
			version: SERVICE_VERSION,
			commit_hash: GIT_COMMIT,
			environment: ENVIRONMENT,
		},
		...baseAttributes,
	};
}

export { loggingConfig, shouldLog } from "./logging-config";
