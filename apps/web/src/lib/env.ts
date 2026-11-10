import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

const isServer = typeof window === "undefined";
// Vite inlines `import.meta.env.NEXT_PUBLIC_*` into the browser bundle. The server reads the live process env.
const source: Record<string, string | undefined> = isServer ? process.env : import.meta.env;

export const env = createEnv({
	clientPrefix: "NEXT_PUBLIC_",
	isServer,
	skipValidation: isServer && process.env.CI === "true",
	server: {
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
	runtimeEnv: {
		INTERNAL_API_SECRET: source.INTERNAL_API_SECRET,
		TURNSTILE_SECRET_KEY: source.TURNSTILE_SECRET_KEY,
		CI: source.CI,
		NEXT_PUBLIC_BACKEND_URL: source.NEXT_PUBLIC_BACKEND_URL,
		NEXT_PUBLIC_CDN_URL: source.NEXT_PUBLIC_CDN_URL,
		NEXT_PUBLIC_WEB_URL: source.NEXT_PUBLIC_WEB_URL,
		NEXT_PUBLIC_GOOGLE_CLIENT_ID: source.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
		NEXT_PUBLIC_SOURCE_COMMIT: source.NEXT_PUBLIC_SOURCE_COMMIT ?? source.SOURCE_COMMIT,
		NEXT_PUBLIC_TURNSTILE_SITE_KEY: source.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
		NEXT_PUBLIC_AXIOM_DATASET: source.NEXT_PUBLIC_AXIOM_DATASET,
		NEXT_PUBLIC_AXIOM_TOKEN: source.NEXT_PUBLIC_AXIOM_TOKEN,
	},
});
