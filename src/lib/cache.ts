import { RedisClient } from "bun";
import { env } from "@/lib/env";
import { logger } from "./logger";

const redis = new RedisClient(env.REDIS_URL);

export interface CacheOptions {
	ttl: number; // TTL in seconds
}

export async function getCached<T>(key: string, fetcher: () => Promise<T>, options: CacheOptions): Promise<T> {
	try {
		const cached = await redis.get(key);
		if (cached) {
			return JSON.parse(cached);
		}
	} catch (error) {
		// If Redis fails, just fetch fresh data
		logger.warn("Redis cache read failed", { error });
	}

	const data = await fetcher();

	try {
		await redis.set(key, JSON.stringify(data));
		await redis.expire(key, options.ttl);
	} catch (error) {
		// If Redis fails, don't fail the request
		logger.warn("Redis cache write failed", { error });
	}

	return data;
}

export async function invalidateCache(key: string): Promise<void> {
	try {
		await redis.del(key);
	} catch (error) {
		logger.warn("Redis cache invalidation failed", { error });
	}
}
