import { join } from "node:path";

export const backendDir = join(import.meta.dir, "..", "..");

function parseEnvFile(text: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}
		const eq = trimmed.indexOf("=");
		if (eq === -1) {
			continue;
		}
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		result[key] = value;
	}
	return result;
}

export const testEnv = parseEnvFile(await Bun.file(join(backendDir, ".env.test")).text());

/**
 * TEST_SHARD=N (N >= 1) moves the whole stack to a private port, database and Redis db so
 * several `bun test` runs can execute concurrently — the global setup drops and recreates its
 * database, which would otherwise collide across runs.
 */
const shard = Number(process.env.TEST_SHARD) || 0;
if (shard > 0) {
	const shardPort = (Number(testEnv.PORT) || 3102) + shard;
	testEnv.PORT = String(shardPort);
	testEnv.BETTER_AUTH_URL = `http://localhost:${shardPort}`;

	const dbUrl = new URL(testEnv.DATABASE_URL ?? "");
	dbUrl.pathname = `${dbUrl.pathname}_sh${shard}`;
	testEnv.DATABASE_URL = dbUrl.toString();

	const redisUrl = new URL(testEnv.REDIS_URL ?? "redis://localhost:6379/1");
	redisUrl.pathname = `/${(Number(redisUrl.pathname.slice(1)) || 1) + shard}`;
	testEnv.REDIS_URL = redisUrl.toString();
}

export const PORT = Number(testEnv.PORT) || 3002;
export const BASE_URL = `http://localhost:${PORT}`;
