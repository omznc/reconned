// Run by Playwright as a webServer entry (it starts webServers before globalSetup, so the
// backend can't be booted there). Resets the dedicated e2e database, migrates + seeds it,
// enables the feature flags the web flows need, flushes the e2e Redis db, then starts the
// backend in-process on the e2e port.
import { rmSync } from "node:fs";
import path from "node:path";
import { RedisClient, SQL } from "bun";
import { backendDir, testEnv } from "./env";

const E2E_DATABASE_URL = (testEnv.DATABASE_URL ?? "").replace(/\/[^/]*$/, "/reconned_e2e");
const E2E_REDIS_URL = "redis://localhost:6379/2";

const e2eEnv: Record<string, string> = {
	...testEnv,
	PORT: "3202",
	DATABASE_URL: E2E_DATABASE_URL,
	REDIS_URL: E2E_REDIS_URL,
	BETTER_AUTH_URL: "http://localhost:3202",
	FRONTEND_URL: "http://localhost:3100",
	CORS_ORIGINS: "http://localhost:3100",
};

const dbName = new URL(E2E_DATABASE_URL).pathname.slice(1);

async function resetDatabase() {
	const adminUrl = new URL(E2E_DATABASE_URL);
	adminUrl.pathname = "/postgres";
	const admin = new SQL(adminUrl.toString());
	await admin.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
	await admin.unsafe(`CREATE DATABASE ${dbName}`);
	await admin.end();
}

function runBackendScript(args: string[], label: string) {
	const result = Bun.spawnSync(args, {
		cwd: backendDir,
		env: { ...process.env, ...e2eEnv },
		stdout: "ignore",
		stderr: "pipe",
	});
	if (result.exitCode !== 0) {
		throw new Error(`${label} failed (exit ${result.exitCode}):\n${result.stderr.toString()}`);
	}
}

async function enableFeatureFlags() {
	const db = new SQL(E2E_DATABASE_URL);
	await db`INSERT INTO "FeatureFlag" (id, name, description, enabled)
		VALUES (${crypto.randomUUID()}, 'EVENT_REGISTRATION', 'e2e', true)`;
	await db.end();
}

async function flushRedis() {
	const redis = new RedisClient(E2E_REDIS_URL);
	await redis.send("FLUSHDB", []);
	redis.close();
}

// The web app's Next.js fetch cache (public pages use next.revalidate) survives on disk
// across runs and would serve entities from a previous, since-dropped e2e database.
// Dev servers write it under .next/dev/cache, production builds under .next/cache.
for (const dir of ["cache", "dev/cache"]) {
	rmSync(path.join(backendDir, "..", "web", ".next", dir, "fetch-cache"), {
		recursive: true,
		force: true,
	});
}

await resetDatabase();
runBackendScript(["bun", "run", "tests/helpers/run-migrations.ts"], "e2e migrations");
runBackendScript(["bun", "run", "src/drizzle/seed.ts"], "e2e db seed");
await enableFeatureFlags();
await flushRedis();

// Start the backend in this process with the e2e environment; src/index.ts calls
// Bun.serve at import time, which is exactly what we want here.
Object.assign(process.env, e2eEnv);
await import("../../src/index");
