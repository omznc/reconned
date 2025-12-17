import { RedisClient } from "bun";
import { env } from "./env";

const redis = new RedisClient(env.REDIS_URL, {
	connectionTimeout: 15000,
	idleTimeout: 60000,
	maxRetries: 20,
});

export async function checkRedisHealth(): Promise<boolean> {
	try {
		await redis.ping();
		return true;
	} catch (error) {
		console.error("Redis health check failed:", error instanceof Error ? error.message : error);
		return false;
	}
}

export { redis };
