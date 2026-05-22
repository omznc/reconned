import type { CacheStore } from "@reconned/router";
import { redis } from "./redis";

export const redisCacheStore: CacheStore = {
	async get(key: string): Promise<string | null> {
		return redis.get(key);
	},

	async set(key: string, value: string, options?: { ttl?: number }): Promise<void> {
		if (options?.ttl) {
			await redis.setex(key, options.ttl, value);
		} else {
			await redis.set(key, value);
		}
	},

	async del(key: string): Promise<void> {
		await redis.del(key);
	},

	async delByPattern(pattern: string): Promise<void> {
		const keys = await redis.keys(pattern);
		if (keys.length > 0) {
			await redis.del(...keys);
		}
	},
};
