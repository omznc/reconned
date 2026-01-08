import { RedisClient } from "bun";
import { env } from "./env";

let redisInstance: RedisClient | null = null;

function getRedis(): RedisClient {
	if (!redisInstance) {
		redisInstance = new RedisClient(env.REDIS_URL, {
			connectionTimeout: 30000,
			idleTimeout: 300000, // 5 minutes
			maxRetries: 5,
		});
	}
	return redisInstance;
}

async function executeWithRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			const isLastAttempt = attempt === maxRetries - 1;
			const isConnectionError =
				error instanceof Error &&
				(error.message.includes("CONNECTION_CLOSED") || error.message.includes("Connection has failed"));

			if (isLastAttempt || !isConnectionError) {
				throw error;
			}

			redisInstance = null; // Force reconnection
			await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
		}
	}
	throw new Error("Max retries exceeded");
}

export async function checkRedisHealth(): Promise<boolean> {
	try {
		await executeWithRetry(() => getRedis().ping());
		return true;
	} catch (error) {
		console.error("Redis health check failed:", error instanceof Error ? error.message : error);
		return false;
	}
}

export const redis = new Proxy({} as RedisClient, {
	get(_target, prop) {
		return (...args: unknown[]) => {
			const client = getRedis();
			const method = client[prop as keyof RedisClient];

			if (typeof method === "function") {
				return executeWithRetry(() => (method as (...args: unknown[]) => Promise<unknown>).apply(client, args));
			}

			return method;
		};
	},
});
