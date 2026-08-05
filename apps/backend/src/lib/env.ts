import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
	skipValidation: process.env.CI === "true",
	server: {
		DATABASE_URL: z
			.url("DATABASE_URL must be a valid URL (e.g., postgresql://user:pass@host:5432/db)")
			.startsWith("postgres", "DATABASE_URL must be a PostgreSQL connection string")
			.describe("PostgreSQL database connection string"),

		FRONTEND_URL: z
			.url("FRONTEND_URL must be a valid URL (e.g., http://localhost:3000)")
			.describe("Frontend base URL"),

		BETTER_AUTH_SECRET: z
			.string()
			.min(32, "BETTER_AUTH_SECRET must be at least 32 characters for security")
			.describe("Secret key for Better Auth sessions"),

		BETTER_AUTH_URL: z
			.url("BETTER_AUTH_URL must be a valid URL (e.g., http://localhost:4000)")
			.describe("Better Auth base URL"),

		CORS_ORIGINS: z
			.string()
			.min(1, "CORS_ORIGINS is required")
			.default("http://localhost:3000,http://localhost:3002,https://reconned.com,https://beta.reconned.com")
			.refine(
				(val) =>
					val.split(",").every((origin) => {
						try {
							new URL(origin.trim());
							return true;
						} catch {
							return false;
						}
					}),
				"CORS_ORIGINS must be a comma-separated list of valid URLs",
			)
			.describe("Comma-separated list of allowed CORS origins"),

		GOOGLE_CLIENT_ID: z
			.string()
			.min(1, "GOOGLE_CLIENT_ID is required for Google OAuth")
			.describe("Google OAuth client ID"),

		GOOGLE_CLIENT_SECRET: z
			.string()
			.min(1, "GOOGLE_CLIENT_SECRET is required for Google OAuth")
			.describe("Google OAuth client secret"),

		REDIS_URL: z
			.url("REDIS_URL must be a valid URL (e.g., redis://localhost:6379)")
			.regex(/^redis:\/\//, "REDIS_URL must start with redis://")
			.describe("Redis connection URL for caching and sessions"),

		ONESIGNAL_APP_ID: z
			.uuid("ONESIGNAL_APP_ID must be a valid UUID")
			.describe("OneSignal application ID for push notifications"),

		ONESIGNAL_API_KEY: z.string().min(1, "ONESIGNAL_API_KEY is required").describe("OneSignal REST API key"),

		TURNSTILE_SECRET_KEY: z
			.string()
			.min(1, "TURNSTILE_SECRET_KEY is required")
			.describe("Cloudflare Turnstile secret key for CAPTCHA verification"),

		INTERNAL_API_SECRET: z
			.string()
			.min(32, "INTERNAL_API_SECRET must be at least 32 characters for security")
			.describe("Secret key for bypassing rate limits on internal API calls"),

		S3_ENDPOINT: z
			.url("S3_ENDPOINT must be a valid URL (e.g., https://s3.amazonaws.com)")
			.describe("S3-compatible storage endpoint URL"),

		S3_REGION: z.string().min(1, "S3_REGION is required (e.g., us-east-1)").describe("S3 region"),

		S3_ACCESS_KEY_ID: z.string().min(1, "S3_ACCESS_KEY_ID is required").describe("S3 access key ID"),

		S3_SECRET_ACCESS_KEY: z.string().min(1, "S3_SECRET_ACCESS_KEY is required").describe("S3 secret access key"),

		S3_BUCKET_NAME: z
			.string()
			.min(1, "S3_BUCKET_NAME is required")
			.regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "S3_BUCKET_NAME must be a valid S3 bucket name")
			.describe("S3 bucket name"),

		CDN_URL: z.url("CDN_URL must be a valid URL").describe("CDN base URL for serving uploaded assets"),

		LOG_LEVEL: z
			.enum(["debug", "info", "warn", "error"])
			.default("info")
			.describe("Logging level: debug, info, warn, or error"),

		LOG_SAMPLING_RATE: z
			.string()
			.transform((val) => Number.parseFloat(val))
			.refine((val) => val >= 0 && val <= 1, "LOG_SAMPLING_RATE must be between 0 and 1")
			.default(1)
			.describe("Log sampling rate: 0.0 to 1.0"),

		POSTHOG_LOGS_ENABLED: z
			.enum(["true", "false"])
			.default("true")
			.transform((val) => val === "true")
			.describe("Enable or disable PostHog logging"),

		FACEBOOK_APP_ID: z
			.string()
			.min(1, "FACEBOOK_APP_ID is required for Facebook OAuth")
			.optional()
			.describe("Facebook application ID"),

		FACEBOOK_APP_SECRET: z
			.string()
			.min(1, "FACEBOOK_APP_SECRET is required for Facebook OAuth")
			.optional()
			.describe("Facebook application secret"),

		FACEBOOK_GRAPH_API_VERSION: z
			.string()
			.regex(/^v\d+\.\d+$/, "FACEBOOK_GRAPH_API_VERSION must look like v23.0")
			.optional()
			.describe("Graph API version to call. Meta retires versions ~2 years after release"),

		POSTHOG_PUBLIC_KEY: z
			.string()
			.min(1, "POSTHOG_PUBLIC_KEY is required for PostHog logging")
			.describe("PostHog public API key"),

		// The management API, not the ingest host (`POSTHOG_HOST`) — different hostname, same
		// region. Configurable so a region move does not leave erasure pointed at the old cluster,
		// still deleting nothing while reporting success.
		POSTHOG_API_HOST: z
			.url("POSTHOG_API_HOST must be a valid URL")
			.default("https://eu.posthog.com")
			.transform((val) => val.replace(/\/+$/, ""))
			.describe("PostHog management API base URL, used for person erasure"),

		// The public key above cannot delete anything; erasing a person needs a personal key scoped
		// to person:write. Optional so the app still boots, but erasure is then incomplete.
		POSTHOG_PERSONAL_API_KEY: z
			.string()
			.min(1)
			.optional()
			.describe(
				"PostHog personal API key (person:write) — required to erase person profiles on account deletion",
			),

		// Plural, and it matters: analytics is split across two projects ("backend" and "web", the
		// latter holding session recordings) and a person exists separately in each.
		POSTHOG_PROJECT_IDS: z
			.string()
			.min(1)
			.optional()
			.transform((val) =>
				val
					?.split(",")
					.map((id) => id.trim())
					.filter(Boolean),
			)
			.describe(
				"Comma-separated PostHog project IDs to erase people from — required alongside POSTHOG_PERSONAL_API_KEY",
			),

		CI: z.string().optional().describe("CI environment indicator"),
	},
	runtimeEnv: process.env,
});
