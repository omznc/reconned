import { beforeEach, describe, expect, test } from "bun:test";
import { createRedisStore, InMemoryRateLimitStore, RedisRateLimitStore } from "../rate-limit-store";

describe("InMemoryRateLimitStore", () => {
	let store: InMemoryRateLimitStore;

	beforeEach(() => {
		store = new InMemoryRateLimitStore();
	});

	describe("zadd and zcard", () => {
		test("should add entries and count them", async () => {
			await store.zadd("test-key", 1000, "entry1");
			await store.zadd("test-key", 2000, "entry2");

			const count = await store.zcard("test-key");
			expect(count).toBe(2);
		});

		test("should return 0 for non-existent key", async () => {
			const count = await store.zcard("non-existent");
			expect(count).toBe(0);
		});

		test("should handle multiple keys independently", async () => {
			await store.zadd("key1", 1000, "entry1");
			await store.zadd("key2", 1000, "entry2");
			await store.zadd("key2", 2000, "entry3");

			expect(await store.zcard("key1")).toBe(1);
			expect(await store.zcard("key2")).toBe(2);
		});
	});

	describe("zremrangebyscore", () => {
		test("should remove entries within score range", async () => {
			await store.zadd("test-key", 1000, "entry1");
			await store.zadd("test-key", 2000, "entry2");
			await store.zadd("test-key", 3000, "entry3");

			await store.zremrangebyscore("test-key", 0, 1500);

			expect(await store.zcard("test-key")).toBe(2);
		});

		test("should handle non-existent key gracefully", async () => {
			// Should not throw for non-existent key
			await store.zremrangebyscore("non-existent", 0, 1000);
			expect(await store.zcard("non-existent")).toBe(0);
		});
	});

	describe("expire", () => {
		test("should delete key after expiration", async () => {
			await store.zadd("test-key", 1000, "entry1");

			await store.expire("test-key", 0.1); // 100ms

			// Wait for expiration
			await new Promise((resolve) => setTimeout(resolve, 150));

			expect(await store.zcard("test-key")).toBe(0);
		});
	});

	describe("clear", () => {
		test("should clear all data", async () => {
			await store.zadd("key1", 1000, "entry1");
			await store.zadd("key2", 1000, "entry2");

			store.clear();

			expect(await store.zcard("key1")).toBe(0);
			expect(await store.zcard("key2")).toBe(0);
		});
	});
});

describe("RedisRateLimitStore", () => {
	test("should delegate to redis client", async () => {
		const mockRedis = {
			zremrangebyscore: async () => 1,
			zcard: async () => 5,
			zadd: async () => 1,
			expire: async () => true,
		};

		const store = new RedisRateLimitStore(mockRedis);

		await store.zremrangebyscore("key", 0, 1000);
		const count = await store.zcard("key");
		await store.zadd("key", 1000, "entry");
		await store.expire("key", 60);

		expect(count).toBe(5);
	});
});

describe("createRedisStore", () => {
	test("should create RedisRateLimitStore with adapted interface", async () => {
		let zaddCalled = false;
		let zcardCalled = false;
		let zremrangebyscoreCalled = false;
		let expireCalled = false;

		const mockRedis = {
			zremrangebyscore: async () => {
				zremrangebyscoreCalled = true;
			},
			zcard: async () => {
				zcardCalled = true;
				return 3;
			},
			zadd: async () => {
				zaddCalled = true;
			},
			expire: async () => {
				expireCalled = true;
			},
		};

		const store = createRedisStore(mockRedis);

		await store.zremrangebyscore("key", 0, 1000);
		const count = await store.zcard("key");
		await store.zadd("key", 1000, "entry");
		await store.expire("key", 60);

		expect(zremrangebyscoreCalled).toBe(true);
		expect(zcardCalled).toBe(true);
		expect(zaddCalled).toBe(true);
		expect(expireCalled).toBe(true);
		expect(count).toBe(3);
	});
});

describe("Rate limiting integration with Router", () => {
	// These tests would require importing Router, but since we're testing
	// the store in isolation, we can test the store behavior that the router relies on

	test("InMemoryRateLimitStore should support sliding window pattern", async () => {
		const store = new InMemoryRateLimitStore();
		const key = "rate-limit:user:123";
		const windowMs = 60000; // 1 minute
		const maxRequests = 3;

		// Simulate requests
		for (let i = 0; i < maxRequests; i++) {
			const now = Date.now();
			const windowStart = now - windowMs;

			await store.zremrangebyscore(key, 0, windowStart);
			const count = await store.zcard(key);

			expect(count).toBe(i);
			expect(count < maxRequests).toBe(true);

			await store.zadd(key, now, `${now}:${i}`);
		}

		// Next request should hit limit
		const now = Date.now();
		const windowStart = now - windowMs;
		await store.zremrangebyscore(key, 0, windowStart);
		const count = await store.zcard(key);

		expect(count).toBe(maxRequests);
	});

	test("old entries should be cleaned up", async () => {
		const store = new InMemoryRateLimitStore();
		const key = "rate-limit:user:123";

		// Add old entries
		const oldTime = Date.now() - 120000; // 2 minutes ago
		await store.zadd(key, oldTime, "old-entry-1");
		await store.zadd(key, oldTime + 1000, "old-entry-2");

		// Add recent entry
		const recentTime = Date.now() - 30000; // 30 seconds ago
		await store.zadd(key, recentTime, "recent-entry");

		// Clean up old entries
		const windowMs = 60000;
		const now = Date.now();
		await store.zremrangebyscore(key, 0, now - windowMs);

		// Only recent entry should remain
		expect(await store.zcard(key)).toBe(1);
	});
});
