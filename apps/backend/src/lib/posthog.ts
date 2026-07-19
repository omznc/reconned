import { logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
	BatchLogRecordProcessor,
	ConsoleLogRecordExporter,
	LoggerProvider,
	type LogRecordProcessor,
	SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { PostHog } from "posthog-node";
import packageJson from "../../package.json";
import { env } from "./env";

const POSTHOG_PUBLIC_KEY = env.POSTHOG_PUBLIC_KEY;
const SERVICE_VERSION = packageJson.version;
const GIT_COMMIT = process.env.GIT_COMMIT || "unknown";
const ENVIRONMENT = process.env.NODE_ENV || "development";

// Determine the correct PostHog host based on the key
// If the key is configured for EU (which is common), use EU endpoints
const POSTHOG_HOST = "https://eu.i.posthog.com";

export const posthog = new PostHog(POSTHOG_PUBLIC_KEY, {
	host: POSTHOG_HOST,
	// POSTHOG_LOGS_ENABLED doubles as the telemetry kill-switch for tests: with it off, neither
	// the OTLP exporter below nor analytics capture may hit the network.
	disabled: !env.POSTHOG_LOGS_ENABLED,
});

// Set up OpenTelemetry logging
const logExporter = new OTLPLogExporter({
	url: `${POSTHOG_HOST}/i/v1/logs`,
	headers: {
		Authorization: `Bearer ${POSTHOG_PUBLIC_KEY}`,
	},
});

// Annotated as the interface, not inferred — the dev-only SimpleLogRecordProcessor below is a
// sibling implementation, not a subtype.
const processors: LogRecordProcessor[] = [];

if (env.POSTHOG_LOGS_ENABLED) {
	processors.push(new BatchLogRecordProcessor(logExporter));
}

if (ENVIRONMENT === "development") {
	processors.push(new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()));
}

const loggerProvider = new LoggerProvider({
	resource: resourceFromAttributes({
		"service.name": "reconned-backend",
		"service.version": SERVICE_VERSION,
		"service.commit_hash": GIT_COMMIT,
		"deployment.environment": ENVIRONMENT,
	}),
	processors,
});

// Set the global logger provider
logs.setGlobalLoggerProvider(loggerProvider);

export const logger = logs.getLogger("reconned-backend", SERVICE_VERSION);

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

// Graceful shutdown
process.on("SIGTERM", async () => {
	await loggerProvider.shutdown();
	await posthog.shutdown();
});

process.on("SIGINT", async () => {
	await loggerProvider.shutdown();
	await posthog.shutdown();
});
