import { RedisClient } from "bun";
import { env } from "./env";
import { logger } from "./posthog";

let redisInstance: RedisClient | null = null;

function getRedis(): RedisClient {
	if (!redisInstance) {
		redisInstance = new RedisClient(env.REDIS_URL, {
			connectionTimeout: 10000,
			idleTimeout: 120000,
			maxRetries: 2,
		});
	}
	return redisInstance;
}

const retryDelays = [200, 500, 1000];

async function executeWithRetry<T>(operation: () => Promise<T>, maxRetries = 2): Promise<T> {
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

			redisInstance = null;
			await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt] ?? 500));
		}
	}
	throw new Error("Max retries exceeded");
}

export async function checkRedisHealth(): Promise<boolean> {
	try {
		await executeWithRetry(() => getRedis().ping());
		return true;
	} catch (error) {
		logger.emit({
			severityText: "error",
			body: "Redis health check failed",
			attributes: {
				error: error instanceof Error ? error.message : String(error),
			},
		});
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
