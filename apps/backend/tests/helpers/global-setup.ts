import { afterAll, beforeAll } from "bun:test";
import { RedisClient, SQL } from "bun";
import { BASE_URL, backendDir, testEnv } from "./env";

const TEST_DB_NAME = new URL(testEnv.DATABASE_URL ?? "").pathname.slice(1) || "reconned_test";

function adminDatabaseUrl(): string {
	const url = new URL(testEnv.DATABASE_URL ?? "");
	url.pathname = "/postgres";
	return url.toString();
}

async function resetDatabase() {
	const admin = new SQL(adminDatabaseUrl());
	await admin.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB_NAME} WITH (FORCE)`);
	await admin.unsafe(`CREATE DATABASE ${TEST_DB_NAME}`);
	await admin.end();
}

function runBackendScript(args: string[], label: string) {
	const result = Bun.spawnSync(args, {
		cwd: backendDir,
		env: { ...process.env, ...testEnv },
		stdout: "pipe",
		stderr: "pipe",
	});
	if (result.exitCode !== 0) {
		throw new Error(
			`${label} failed (exit ${result.exitCode}):\n${result.stdout.toString()}\n${result.stderr.toString()}`,
		);
	}
}

async function flushRedis() {
	const redis = new RedisClient(testEnv.REDIS_URL ?? "redis://localhost:6379/1");
	await redis.send("FLUSHDB", []);
	redis.close();
}

beforeAll(async () => {
	await resetDatabase();
	runBackendScript(["bun", "run", "tests/helpers/run-migrations.ts"], "migrations");
	runBackendScript(["bun", "run", "src/drizzle/seed.ts"], "db seed");
	await flushRedis();

	// The server runs in-process (not as a subprocess) so `bun test --coverage` measures the
	// actual backend source. Bun auto-loads .env from the cwd before tests run, so the test
	// values must be forced over it before src/lib/env validates process.env at import.
	Object.assign(process.env, testEnv);
	await import("../../src/index");

	const response = await fetch(`${BASE_URL}/api/openapi.json`, { signal: AbortSignal.timeout(5_000) });
	if (!response.ok) {
		throw new Error(`Backend not ready after in-process boot: ${response.status}`);
	}
});

afterAll(async () => {
	// Stop the listener and scheduler so the test process can exit cleanly.
	const [{ server }, { scheduler }] = await Promise.all([
		import("../../src/index"),
		import("../../src/tasks/scheduler"),
	]);
	scheduler.stop();
	server.stop(true);
	const { testDb } = await import("./auth");
	await testDb.end();
});
