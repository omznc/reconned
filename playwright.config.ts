import { defineConfig, devices } from "@playwright/test";

// The E2E stack is fully isolated from dev: web on 3100, backend on 3202 (spawned by
// e2e/global-setup.ts), database reconned_e2e, redis db /2. Ports/URLs here must stay in
// sync with apps/backend/tests/helpers/e2e-prepare.ts.
const WEB_PORT = 3100;
const BACKEND_URL = "http://localhost:3202";

const webEnv = {
	CI: "true", // skips t3-env validation so the dummy values below pass
	NEXT_PUBLIC_BACKEND_URL: BACKEND_URL,
	BACKEND_INTERNAL_URL: BACKEND_URL,
	NEXT_PUBLIC_WEB_URL: `http://localhost:${WEB_PORT}`,
	// Cloudflare Turnstile always-pass test site key
	NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
	INTERNAL_API_SECRET: "test-internal-secret-test-internal-secret",
	// Any valid 32-byte base64 value works for next's server-action encryption in tests
	NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE=",
	NEXT_PUBLIC_CDN_URL: "http://localhost:9000/test",
	GOOGLE_CLIENT_ID: "test-google-client-id",
	// Client-bundle env validation can't see CI=true (it's not NEXT_PUBLIC_), so every var in
	// env.ts's `client` block must be present or auth pages crash in the browser.
	NEXT_PUBLIC_GOOGLE_CLIENT_ID: "test-google-client-id",
	NEXT_PUBLIC_AXIOM_DATASET: "test",
	NEXT_PUBLIC_AXIOM_TOKEN: "test",
	ADMIN_WEBHOOK_TOKEN: "test-admin-webhook-token",
};

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
	timeout: 60_000,
	globalSetup: "./e2e/global-setup.ts",
	use: {
		baseURL: `http://localhost:${WEB_PORT}`,
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "public",
			testMatch: ["smoke.spec.ts", "auth.spec.ts"],
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "authed",
			testMatch: ["club.spec.ts", "event.spec.ts"],
			use: {
				...devices["Desktop Chrome"],
				storageState: "e2e/.auth/user.json",
			},
		},
	],
	// Playwright starts webServers BEFORE globalSetup, so the backend must be one of them:
	// e2e-serve.ts resets/migrates/seeds the e2e database and then serves on 3202.
	webServer: [
		{
			command: "bun run tests/helpers/e2e-serve.ts",
			cwd: "./apps/backend",
			url: `${BACKEND_URL}/api/openapi.json`,
			reuseExistingServer: false,
			timeout: 120_000,
		},
		{
			command: `bun --bun next dev --turbo -p ${WEB_PORT}`,
			cwd: "./apps/web",
			url: `http://localhost:${WEB_PORT}`,
			reuseExistingServer: !process.env.CI,
			timeout: 180_000,
			env: webEnv,
		},
	],
});
