/**
 * In-memory rate limit store implementation
 * Uses a Map to store rate limit data
 * Note: This is not suitable for distributed systems - use Redis store for that
 */

import type { RateLimitStore } from "./types";

interface RateLimitEntry {
	score: number;
	member: string;
}

export class InMemoryRateLimitStore implements RateLimitStore {
	private store = new Map<string, RateLimitEntry[]>();

	async zremrangebyscore(key: string, min: number, max: number): Promise<void> {
		const entries = this.store.get(key);
		if (!entries) return;

		const filtered = entries.filter((entry) => entry.score < min || entry.score > max);
		this.store.set(key, filtered);
	}

	async zcard(key: string): Promise<number> {
		const entries = this.store.get(key);
		return entries?.length ?? 0;
	}

	async zadd(key: string, score: number, member: string): Promise<void> {
		const entries = this.store.get(key) ?? [];
		entries.push({ score, member });
		this.store.set(key, entries);
	}

	async expire(key: string, seconds: number): Promise<void> {
		// In-memory store doesn't need explicit expiration
		// We clean up in zremrangebyscore
		// But we can set a timer to clean up old keys
		setTimeout(() => {
			this.store.delete(key);
		}, seconds * 1000);
	}

	/**
	 * Clear all stored data (useful for testing)
	 */
	clear(): void {
		this.store.clear();
	}
}

/**
 * Redis rate limit store implementation
 * Requires a Redis client with the following methods:
 * - zremrangebyscore(key, min, max)
 * - zcard(key)
 * - zadd(key, score, member)
 * - expire(key, seconds)
 */
export class RedisRateLimitStore implements RateLimitStore {
	constructor(
		private readonly redis: {
			zremrangebyscore: (key: string, min: number, max: number) => Promise<undefined | number>;
			zcard: (key: string) => Promise<number>;
			zadd: (key: string, score: number, member: string) => Promise<undefined | number>;
			expire: (key: string, seconds: number) => Promise<undefined | boolean>;
		},
	) {}

	async zremrangebyscore(key: string, min: number, max: number): Promise<void> {
		await this.redis.zremrangebyscore(key, min, max);
	}

	async zcard(key: string): Promise<number> {
		return await this.redis.zcard(key);
	}

	async zadd(key: string, score: number, member: string): Promise<void> {
		await this.redis.zadd(key, score, member);
	}

	async expire(key: string, seconds: number): Promise<void> {
		await this.redis.expire(key, seconds);
	}
}

/**
 * Create a Redis store from a standard Redis client
 * Works with ioredis and similar clients
 */
export function createRedisStore(redis: {
	zremrangebyscore: (key: string, min: number | string, max: number | string) => Promise<unknown>;
	zcard: (key: string) => Promise<number>;
	zadd: (key: string, score: number | string, member: string) => Promise<unknown>;
	expire: (key: string, seconds: number | string) => Promise<unknown>;
}): RedisRateLimitStore {
	return new RedisRateLimitStore({
		zremrangebyscore: async (key, min, max) => {
			await redis.zremrangebyscore(key, min, max);
			return undefined;
		},
		zcard: async (key) => {
			return await redis.zcard(key);
		},
		zadd: async (key, score, member) => {
			await redis.zadd(key, score, member);
			return undefined;
		},
		expire: async (key, seconds) => {
			await redis.expire(key, seconds);
			return undefined;
		},
	});
}
