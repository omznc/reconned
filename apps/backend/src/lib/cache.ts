import type { CacheStore, RateLimitStore } from "@reconned/router";
import { logger } from "./posthog";
import { redis } from "./redis";

const SCAN_BATCH = 100;

/**
 * Delete every key matching a glob pattern using a non-blocking SCAN cursor loop.
 *
 * `KEYS` is O(keyspace) and blocks the entire Redis server for the duration, so it must
 * never be used on a live instance. `SCAN` walks the keyspace in small batches instead;
 * we delete each batch as we go so memory stays flat regardless of keyspace size.
 */
export async function deleteKeysByPattern(pattern: string): Promise<number> {
	let cursor = "0";
	let deleted = 0;

	do {
		const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", SCAN_BATCH);
		cursor = nextCursor;

		if (keys.length > 0) {
			await redis.del(...keys);
			deleted += keys.length;
		}
	} while (cursor !== "0");

	return deleted;
}

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

	/**
	 * `SET key 1 NX EX ttl` — atomic claim, so exactly one caller across all replicas sees "OK".
	 *
	 * Sent as a raw command because the client's typed `set` does not expose `NX`. A failure to
	 * reach Redis returns `false` (nobody revalidates this round, the stale entry is served until
	 * the next request) rather than throwing, which would be reported as a revalidation error.
	 */
	async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
		try {
			const result = await redis.send("SET", [key, "1", "NX", "EX", String(ttlSeconds)]);
			return result === "OK";
		} catch (error) {
			logger.emit({
				severityText: "warn",
				body: "Could not acquire revalidation lock",
				attributes: {
					key,
					error: error instanceof Error ? error.message : String(error),
				},
			});
			return false;
		}
	},

	/**
	 * Cache invalidation is intentionally fire-and-forget: the router awaits this call in the
	 * response path of every mutation, and a multi-round-trip SCAN must not sit between the
	 * handler finishing and the client getting its response. Failures are logged, never swallowed.
	 */
	async delByPattern(pattern: string): Promise<void> {
		void deleteKeysByPattern(pattern).catch((error) => {
			logger.emit({
				severityText: "error",
				body: "Cache invalidation failed",
				attributes: {
					pattern,
					error: error instanceof Error ? error.message : String(error),
				},
			});
		});
	},
};

/**
 * Keys with this prefix are treated as unlimited. The router's rate limiter has no "skip this
 * request" hook, only a `keyGenerator`, so trusted callers are routed to a bypass key here and
 * every store operation short-circuits — no Redis round-trips at all for internal traffic.
 */
export const RATE_LIMIT_BYPASS_PREFIX = "ratelimit:bypass";

/**
 * Redis-backed sliding-window rate limit store.
 *
 * The router's built-in store is an in-memory Map, which means each instance enforces its own
 * independent limit — useless behind more than one replica. This keeps the window in Redis so
 * the limit is global.
 */
export const redisRateLimitStore: RateLimitStore = {
	async zremrangebyscore(key: string, min: number, max: number): Promise<void> {
		if (key.startsWith(RATE_LIMIT_BYPASS_PREFIX)) {
			return;
		}
		await redis.zremrangebyscore(key, min, max);
	},

	async zcard(key: string): Promise<number> {
		if (key.startsWith(RATE_LIMIT_BYPASS_PREFIX)) {
			return 0;
		}
		return redis.zcard(key);
	},

	async zadd(key: string, score: number, member: string): Promise<void> {
		if (key.startsWith(RATE_LIMIT_BYPASS_PREFIX)) {
			return;
		}
		await redis.zadd(key, score, member);
	},

	async expire(key: string, seconds: number): Promise<void> {
		if (key.startsWith(RATE_LIMIT_BYPASS_PREFIX)) {
			return;
		}
		await redis.expire(key, seconds);
	},
};
