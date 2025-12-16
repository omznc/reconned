import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	skipValidation: process.env.CI === "true",
	server: {
		DATABASE_URL: z
			.string()
			.url("DATABASE_URL must be a valid URL (e.g., postgresql://user:pass@host:5432/db)")
			.startsWith("postgres", "DATABASE_URL must be a PostgreSQL connection string"),

		BETTER_AUTH_SECRET: z
			.string()
			.min(32, "BETTER_AUTH_SECRET must be at least 32 characters for security")
			.describe("Secret key for Better Auth sessions"),

		S3_ENDPOINT: z.string().url("S3_ENDPOINT must be a valid URL (e.g., https://s3.amazonaws.com)"),

		S3_REGION: z.string().min(1, "S3_REGION is required (e.g., us-east-1)").describe("AWS S3 region"),

		S3_ACCESS_KEY_ID: z.string().min(1, "S3_ACCESS_KEY_ID is required").describe("AWS S3 access key ID"),

		S3_SECRET_ACCESS_KEY: z
			.string()
			.min(1, "S3_SECRET_ACCESS_KEY is required")
			.describe("AWS S3 secret access key"),

		S3_BUCKET_NAME: z
			.string()
			.min(1, "S3_BUCKET_NAME is required")
			.regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "S3_BUCKET_NAME must be a valid S3 bucket name")
			.describe("AWS S3 bucket name"),

		GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required for Google OAuth"),

		ONESIGNAL_APP_ID: z
			.string()
			.uuid("ONESIGNAL_APP_ID must be a valid UUID")
			.describe("OneSignal application ID for push notifications"),

		ONESIGNAL_API_KEY: z.string().min(1, "ONESIGNAL_API_KEY is required").describe("OneSignal REST API key"),

		ADMIN_WEBHOOK_TOKEN: z
			.string()
			.min(32, "ADMIN_WEBHOOK_TOKEN must be at least 32 characters for security")
			.describe("Secret token for admin webhook authentication"),

		TURNSTILE_SECRET_KEY: z
			.string()
			.min(1, "TURNSTILE_SECRET_KEY is required")
			.optional()
			.describe("Cloudflare Turnstile secret key for CAPTCHA verification"),

		FACEBOOK_APP_ID: z
			.string()
			.min(1, "FACEBOOK_APP_ID is required for Facebook OAuth")
			.describe("Facebook application ID"),

		FACEBOOK_APP_SECRET: z
			.string()
			.min(1, "FACEBOOK_APP_SECRET is required for Facebook OAuth")
			.describe("Facebook application secret"),

		REDIS_URL: z
			.string()
			.url("REDIS_URL must be a valid URL (e.g., redis://localhost:6379)")
			.regex(/^redis:\/\//, "REDIS_URL must start with redis://")
			.describe("Redis connection URL for caching and sessions"),

		CI: z.string().optional().describe("CI environment indicator"),
	},
	client: {
		NEXT_PUBLIC_BACKEND_URL: z
			.string()
			.url("NEXT_PUBLIC_BACKEND_URL must be a valid URL (e.g., http://localhost:4000)")
			.describe("Backend API base URL"),

		NEXT_PUBLIC_CDN_URL: z
			.string()
			.url("NEXT_PUBLIC_CDN_URL must be a valid URL")
			.describe("CDN base URL for static assets"),

		NEXT_PUBLIC_BETTER_AUTH_URL: z
			.string()
			.url("NEXT_PUBLIC_BETTER_AUTH_URL must be a valid URL")
			.describe("Better Auth authentication URL"),

		NEXT_PUBLIC_GOOGLE_CLIENT_ID: z
			.string()
			.min(1, "NEXT_PUBLIC_GOOGLE_CLIENT_ID is required for Google OAuth")
			.describe("Google OAuth client ID"),

		NEXT_PUBLIC_ALLOWED_FILE_TYPES: z
			.string()
			.optional()
			.describe("Comma-separated list of allowed file MIME types"),

		NEXT_PUBLIC_MAX_FILE_SIZE: z.string().optional().describe("Maximum file upload size in bytes"),

		NEXT_PUBLIC_SOURCE_COMMIT: z.string().optional().describe("Git commit hash for version tracking"),

		NEXT_PUBLIC_IMGUR_CLIENT_ID: z
			.string()
			.min(1, "NEXT_PUBLIC_IMGUR_CLIENT_ID is required for Imgur integration")
			.describe("Imgur API client ID"),

		NEXT_PUBLIC_TURNSTILE_SITE_KEY: z
			.string()
			.min(1, "NEXT_PUBLIC_TURNSTILE_SITE_KEY is required")
			.describe("Cloudflare Turnstile site key for CAPTCHA"),

		NEXT_PUBLIC_AXIOM_DATASET: z
			.string()
			.min(1, "NEXT_PUBLIC_AXIOM_DATASET is required for logging")
			.describe("Axiom dataset name for logs"),

		NEXT_PUBLIC_AXIOM_TOKEN: z
			.string()
			.min(1, "NEXT_PUBLIC_AXIOM_TOKEN is required for logging")
			.describe("Axiom API token"),

		NEXT_PUBLIC_BETA: z
			.string()
			.optional()
			.transform((val) => (val ?? "false") === "true")
			.describe("Enable beta features (true/false)"),
	},
	experimental__runtimeEnv: {
		NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
		NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
		NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
		NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
		NEXT_PUBLIC_ALLOWED_FILE_TYPES: process.env.NEXT_PUBLIC_ALLOWED_FILE_TYPES,
		NEXT_PUBLIC_MAX_FILE_SIZE: process.env.NEXT_PUBLIC_MAX_FILE_SIZE,
		NEXT_PUBLIC_SOURCE_COMMIT: process.env.SOURCE_COMMIT,
		NEXT_PUBLIC_IMGUR_CLIENT_ID: process.env.NEXT_PUBLIC_IMGUR_CLIENT_ID,
		NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
		NEXT_PUBLIC_AXIOM_DATASET: process.env.NEXT_PUBLIC_AXIOM_DATASET,
		NEXT_PUBLIC_AXIOM_TOKEN: process.env.NEXT_PUBLIC_AXIOM_TOKEN,
		NEXT_PUBLIC_BETA: process.env.NEXT_PUBLIC_BETA,
	},
});
