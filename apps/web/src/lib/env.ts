import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
	skipValidation: process.env.NEXT_PHASE === "phase-production-build" || process.env.CI === "true",
	server: {
		ADMIN_WEBHOOK_TOKEN: z
			.string()
			.min(32, "ADMIN_WEBHOOK_TOKEN must be at least 32 characters for security")
			.describe("Secret token for admin webhook authentication"),

		TURNSTILE_SECRET_KEY: z
			.string()
			.min(1, "TURNSTILE_SECRET_KEY is required")
			.optional()
			.describe("Cloudflare Turnstile secret key for CAPTCHA verification"),

		INTERNAL_API_SECRET: z
			.string()
			.min(32, "INTERNAL_API_SECRET must be at least 32 characters for security")
			.describe("Secret key for bypassing rate limits on internal API calls"),

		CI: z.string().optional().describe("CI environment indicator"),

		NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: z
			.string()
			.min(32, "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY must be at least 32 characters")
			.describe("Encryption key for server actions. Generate with: openssl rand -base64 32"),
	},
	client: {
		NEXT_PUBLIC_BACKEND_URL: z
			.url("NEXT_PUBLIC_BACKEND_URL must be a valid URL (e.g., http://localhost:4000)")
			.describe("Backend API base URL"),

		NEXT_PUBLIC_CDN_URL: z
			.url("NEXT_PUBLIC_CDN_URL must be a valid URL")
			.describe("CDN base URL for static assets"),

		NEXT_PUBLIC_WEB_URL: z
			.url("NEXT_PUBLIC_WEB_URL must be a valid URL")
			.describe("Better Auth authentication URL"),

		NEXT_PUBLIC_GOOGLE_CLIENT_ID: z
			.string()
			.min(1, "NEXT_PUBLIC_GOOGLE_CLIENT_ID is required for Google OAuth")
			.describe("Google OAuth client ID"),
		NEXT_PUBLIC_SOURCE_COMMIT: z.string().optional().describe("Git commit hash for version tracking"),
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
	},
	experimental__runtimeEnv: {
		NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
		NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
		NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL,
		NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
		NEXT_PUBLIC_SOURCE_COMMIT: process.env.SOURCE_COMMIT,
		NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
		NEXT_PUBLIC_AXIOM_DATASET: process.env.NEXT_PUBLIC_AXIOM_DATASET,
		NEXT_PUBLIC_AXIOM_TOKEN: process.env.NEXT_PUBLIC_AXIOM_TOKEN,
	},
});
