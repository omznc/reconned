import { RedisClient } from "bun";
import { env } from "./env";
import { logger } from "./posthog";

let redisInstance: RedisClient | null = null;

function getRedis(): RedisClient {
	if (!redisInstance) {
		redisInstance = new RedisClient(env.REDIS_URL, {
			connectionTimeout: 10000,
			idleTimeout: 120000,
			maxRetries: 5,
		});
	}
	return redisInstance;
}

const retryDelays = [200, 500, 1000, 1500, 2000];

async function executeWithRetry<T>(operation: () => Promise<T>, maxRetries = 5): Promise<T> {
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			const isLastAttempt = attempt === maxRetries - 1;
			// "Idle timeout reached" is the client tearing down a connection it considers stale.
			// It is recoverable the same way as an outright close — drop the instance and reconnect.
			const isConnectionError =
				error instanceof Error &&
				(error.message.includes("CONNECTION_CLOSED") ||
					error.message.includes("Connection has failed") ||
					error.message.includes("Idle timeout"));

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

// One wrapper per method name, created lazily — not one per call.
const wrapperCache = new Map<PropertyKey, (...args: unknown[]) => Promise<unknown>>();

export const redis = new Proxy({} as RedisClient, {
	get(_target, prop) {
		const cached = wrapperCache.get(prop);
		if (cached) {
			return cached;
		}

		const value = getRedis()[prop as keyof RedisClient];

		// Non-function properties (e.g. `connected`) must pass through as values, not be
		// wrapped into a function that never gets called.
		if (typeof value !== "function") {
			return value;
		}

		const wrapper = (...args: unknown[]) =>
			executeWithRetry(() => {
				// Re-resolve the client on every attempt: a retry clears `redisInstance`, so a
				// captured reference would keep calling the dead connection.
				const client = getRedis();
				const method = client[prop as keyof RedisClient] as (...args: unknown[]) => Promise<unknown>;
				return method.apply(client, args);
			});

		wrapperCache.set(prop, wrapper);
		return wrapper;
	},
});
