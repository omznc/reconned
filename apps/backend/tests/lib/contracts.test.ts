import { describe, expect, test } from "bun:test";
// `validation-contracts.ts` imports nothing but zod, so it is safe to import statically.
import { createHttpsUrlSchema, isHttpsUrl, normalizeWebsiteUrl } from "../../src/lib/validation-contracts";
import { createUser, makeAdmin, testDb } from "../helpers/auth";
import { api } from "../helpers/client";

// `src/lib/db` (pulled in transitively by dataloader.ts and feature-flags.ts) opens its
// connection from `process.env.DATABASE_URL` at module load time. The test harness only forces
// `.env.test` values onto `process.env` inside global-setup's `beforeAll`, which runs *after* a
// test file's top-level imports are evaluated. A static import here would permanently bind the
// shared `global.__db` singleton to whatever `.env` had at file-collection time (not the sharded
// test database), breaking every other test in the file too. Import dynamically instead, from
// inside each test, once `beforeAll` has already run.
async function loadDataloaderModule() {
	return import("../../src/lib/dataloader");
}
async function loadFeatureFlagsModule() {
	return import("../../src/lib/feature-flags");
}
async function loadCacheModule() {
	return import("../../src/lib/cache");
}
async function loadRedis() {
	const { redis } = await import("../../src/lib/redis");
	return redis;
}

describe("DataLoader", () => {
	test("load() batches a single key through batchLoadFn and caches the result", async () => {
		const { DataLoader } = await loadDataloaderModule();
		let callCount = 0;
		const loader = new DataLoader<string, number>(async (keys) => {
			callCount++;
			return new Map(keys.map((k) => [k, k.length]));
		});

		const first = await loader.load("abc");
		expect(first).toBe(3);
		expect(callCount).toBe(1);

		// Second load of the same key should hit the cache, not call batchLoadFn again.
		const second = await loader.load("abc");
		expect(second).toBe(3);
		expect(callCount).toBe(1);
	});

	test("load() rejects when the batch function returns no value for the key", async () => {
		const { DataLoader } = await loadDataloaderModule();
		const loader = new DataLoader<string, number>(async () => new Map());
		await expect(loader.load("missing")).rejects.toThrow("No result found for key: missing");
	});

	test("load() coalesces concurrent requests for the same uncached key", async () => {
		const { DataLoader } = await loadDataloaderModule();
		let callCount = 0;
		const loader = new DataLoader<string, number>(async (keys) => {
			callCount++;
			return new Map(keys.map((k) => [k, 42]));
		});

		const [a, b] = await Promise.all([loader.load("x"), loader.load("x")]);
		expect(a).toBe(42);
		expect(b).toBe(42);
		expect(callCount).toBe(1);
	});

	test("loadMany() serves cached keys without re-invoking batchLoadFn and fetches the rest", async () => {
		const { DataLoader } = await loadDataloaderModule();
		let batchedKeys: string[] = [];
		const loader = new DataLoader<string, number>(async (keys) => {
			batchedKeys = keys;
			return new Map(keys.map((k) => [k, k.length]));
		});

		await loader.load("a");
		batchedKeys = [];

		const results = await loader.loadMany(["a", "bb", "ccc"]);
		expect(results.get("a")).toBe(1);
		expect(results.get("bb")).toBe(2);
		expect(results.get("ccc")).toBe(3);
		// "a" was already cached, so only the uncached keys should have been re-batched.
		expect(batchedKeys.sort()).toEqual(["bb", "ccc"]);
	});

	test("loadMany() with an empty key list never calls batchLoadFn", async () => {
		const { DataLoader } = await loadDataloaderModule();
		let called = false;
		const loader = new DataLoader<string, number>(async (keys) => {
			called = true;
			return new Map(keys.map((k) => [k, 0]));
		});

		const results = await loader.loadMany([]);
		expect(results.size).toBe(0);
		expect(called).toBeFalse();
	});

	test("clear(key) removes a single cached entry, clear() removes all", async () => {
		const { DataLoader } = await loadDataloaderModule();
		const loader = new DataLoader<string, number>(async (keys) => new Map(keys.map((k) => [k, k.length])));

		await loader.load("one");
		await loader.load("two");

		loader.clear("one");
		let calls = 0;
		const tracking = new DataLoader<string, number>(async (keys) => {
			calls++;
			return new Map(keys.map((k) => [k, k.length]));
		});
		await tracking.load("z");
		tracking.clear();
		await tracking.load("z");
		expect(calls).toBe(2);
	});
});

describe("createIdDataLoader", () => {
	test("maps selectFn results by id and applies the transform", async () => {
		const { createIdDataLoader } = await loadDataloaderModule();
		type Row = { id: string; value: number };
		const rows: Row[] = [
			{ id: "a", value: 1 },
			{ id: "b", value: 2 },
		];

		const loader = createIdDataLoader<Row, string, number>(
			async (ids) => rows.filter((r) => ids.includes(r.id)),
			(row) => row.id,
			(row) => row.value * 10,
		);

		const results = await loader.loadMany(["a", "b"]);
		expect(results.get("a")).toBe(10);
		expect(results.get("b")).toBe(20);
	});

	test("without a transform, the raw row is stored", async () => {
		const { createIdDataLoader } = await loadDataloaderModule();
		type Row = { id: string; value: number };
		const rows: Row[] = [{ id: "a", value: 1 }];

		const loader = createIdDataLoader<Row, string, Row>(
			async (ids) => rows.filter((r) => ids.includes(r.id)),
			(row) => row.id,
		);

		const results = await loader.loadMany(["a"]);
		expect(results.get("a")).toEqual({ id: "a", value: 1 });
	});
});

describe("batchLoadRelationships", () => {
	test("groups related items under each parent's key", async () => {
		const { batchLoadRelationships } = await loadDataloaderModule();
		type Parent = { id: string; childIds: string[] };
		type Child = { id: string; name: string };

		const parents: Parent[] = [
			{ id: "p1", childIds: ["c1", "c2"] },
			{ id: "p2", childIds: ["c2"] },
			{ id: "p3", childIds: [] },
		];
		const children: Child[] = [
			{ id: "c1", name: "Child One" },
			{ id: "c2", name: "Child Two" },
		];

		const result = await batchLoadRelationships(
			parents,
			(p) => p.id,
			(p) => p.childIds,
			async (keys) => children.filter((c) => keys.includes(c.id)),
			(c) => c.id,
		);

		expect(result.get("p1")).toEqual([
			{ id: "c1", name: "Child One" },
			{ id: "c2", name: "Child Two" },
		]);
		expect(result.get("p2")).toEqual([{ id: "c2", name: "Child Two" }]);
		expect(result.get("p3")).toEqual([]);
	});

	test("applies a transform function over the parent + related items", async () => {
		const { batchLoadRelationships } = await loadDataloaderModule();
		type Parent = { id: string; childIds: string[] };
		type Child = { id: string; name: string };

		const parents: Parent[] = [{ id: "p1", childIds: ["c1"] }];
		const children: Child[] = [{ id: "c1", name: "Child One" }];

		const result = await batchLoadRelationships(
			parents,
			(p) => p.id,
			(p) => p.childIds,
			async (keys) => children.filter((c) => keys.includes(c.id)),
			(c) => c.id,
			(parent, related) => ({ parentId: parent.id, count: related.length }),
		);

		expect(result.get("p1")).toEqual({ parentId: "p1", count: 1 });
	});
});

describe("feature-flags direct unit coverage", () => {
	test("getEnabledFlags() returns only enabled flags keyed by name", async () => {
		const { getEnabledFlags } = await loadFeatureFlagsModule();
		const flagName = `TEST_FLAG_${crypto.randomUUID().slice(0, 8)}`;
		const disabledName = `TEST_FLAG_${crypto.randomUUID().slice(0, 8)}`;
		await testDb`INSERT INTO "FeatureFlag" (id, name, enabled) VALUES (${crypto.randomUUID()}, ${flagName}, true)`;
		await testDb`INSERT INTO "FeatureFlag" (id, name, enabled) VALUES (${crypto.randomUUID()}, ${disabledName}, false)`;

		const flags = await getEnabledFlags();
		expect(flags[flagName]).toBe(true);
		expect(flags[disabledName]).toBeUndefined();
	});

	test("clearFeatureFlagsCache() with no argument deletes all feature_flag:* keys", async () => {
		const { clearFeatureFlagsCache } = await loadFeatureFlagsModule();
		const redis = await loadRedis();
		const flagName = `TEST_FLAG_${crypto.randomUUID().slice(0, 8)}`;
		await redis.setex(`feature_flag:${flagName}`, 300, "1");
		expect(await redis.get(`feature_flag:${flagName}`)).toBe("1");

		await clearFeatureFlagsCache();

		expect(await redis.get(`feature_flag:${flagName}`)).toBeNull();
	});

	test("isFeatureEnabled() reads through to the DB and caches the result", async () => {
		const { isFeatureEnabled } = await loadFeatureFlagsModule();
		const redis = await loadRedis();
		const flagName = `TEST_FLAG_${crypto.randomUUID().slice(0, 8)}`;
		await redis.del(`feature_flag:${flagName}`);
		await testDb`INSERT INTO "FeatureFlag" (id, name, enabled) VALUES (${crypto.randomUUID()}, ${flagName}, true)`;

		const enabled = await isFeatureEnabled(flagName);
		expect(enabled).toBeTrue();

		// Subsequent call should hit the Redis cache set by the first call.
		const cached = await redis.get(`feature_flag:${flagName}`);
		expect(cached).toBe("1");
	});

	test("isFeatureEnabled() returns false for an unknown flag", async () => {
		const { isFeatureEnabled } = await loadFeatureFlagsModule();
		const flagName = `TEST_FLAG_UNKNOWN_${crypto.randomUUID().slice(0, 8)}`;
		const enabled = await isFeatureEnabled(flagName);
		expect(enabled).toBeFalse();
	});
});

describe("ONLY_VERIFIED_CLUBS_VISIBLE feature flag through GET /clubs", () => {
	async function setFlag(enabled: boolean) {
		const redis = await loadRedis();
		const existing = await testDb`SELECT id FROM "FeatureFlag" WHERE name = 'ONLY_VERIFIED_CLUBS_VISIBLE' LIMIT 1`;
		if (existing.length > 0) {
			await testDb`UPDATE "FeatureFlag" SET enabled = ${enabled} WHERE name = 'ONLY_VERIFIED_CLUBS_VISIBLE'`;
		} else {
			await testDb`INSERT INTO "FeatureFlag" (id, name, enabled) VALUES (${crypto.randomUUID()}, 'ONLY_VERIFIED_CLUBS_VISIBLE', ${enabled})`;
		}
		await redis.del("feature_flag:ONLY_VERIFIED_CLUBS_VISIBLE");
	}

	test("hides unverified clubs from non-admins when the flag is enabled", async () => {
		const owner = await createUser();
		const countries = await api(owner.cookie).get("/api/countries");
		const countryId = countries.body[0]?.id;
		const created = await api(owner.cookie).post("/api/clubs", {
			name: `Flag Club ${crypto.randomUUID().slice(0, 8)}`,
			countryId,
			location: "Sarajevo",
		});
		expect(created.status).toBe(200);
		const clubId = created.body.club.id as string;

		try {
			await setFlag(true);

			const response = await api().get(`/api/clubs?search=${encodeURIComponent(created.body.club.name)}`);
			expect(response.status).toBe(200);
			const found = response.body.clubs.find((c: { id: string }) => c.id === clubId);
			expect(found).toBeUndefined();
		} finally {
			await setFlag(false);
		}
	});
});

describe("redisCacheStore direct unit coverage", () => {
	test("del() removes a key set via set()", async () => {
		const { redisCacheStore } = await loadCacheModule();
		const key = `test:cache:${crypto.randomUUID()}`;
		await redisCacheStore.set(key, "value", { ttl: 60 });
		expect(await redisCacheStore.get(key)).toBe("value");

		await redisCacheStore.del(key);
		expect(await redisCacheStore.get(key)).toBeNull();
	});

	test("acquireLock() succeeds once and fails on a second attempt while held", async () => {
		const { redisCacheStore } = await loadCacheModule();
		const redis = await loadRedis();
		const key = `test:lock:${crypto.randomUUID()}`;
		// acquireLock is optional on the CacheStore interface but always defined on this store.
		if (!redisCacheStore.acquireLock) {
			throw new Error("redisCacheStore.acquireLock is not defined");
		}
		const first = await redisCacheStore.acquireLock(key, 30);
		expect(first).toBeTrue();

		const second = await redisCacheStore.acquireLock(key, 30);
		expect(second).toBeFalse();

		await redis.del(key);
	});

	test("set() without a ttl stores the value without expiry", async () => {
		const { redisCacheStore } = await loadCacheModule();
		const key = `test:cache:nottl:${crypto.randomUUID()}`;
		await redisCacheStore.set(key, "persisted");
		expect(await redisCacheStore.get(key)).toBe("persisted");
		await redisCacheStore.del(key);
	});
});

describe("validation-contracts edge cases", () => {
	test("normalizeWebsiteUrl leaves an empty string untouched", () => {
		expect(normalizeWebsiteUrl("")).toBe("");
	});

	test("normalizeWebsiteUrl adds https:// to a bare host", () => {
		expect(normalizeWebsiteUrl("example.com")).toBe("https://example.com");
	});

	test("normalizeWebsiteUrl trims whitespace before checking for a protocol", () => {
		expect(normalizeWebsiteUrl("  example.com  ")).toBe("https://example.com");
	});

	test("normalizeWebsiteUrl leaves an existing protocol (even non-https) untouched", () => {
		expect(normalizeWebsiteUrl("http://example.com")).toBe("http://example.com");
		expect(normalizeWebsiteUrl("ftp://example.com")).toBe("ftp://example.com");
	});

	test("isHttpsUrl allows an empty string", () => {
		expect(isHttpsUrl("")).toBeTrue();
	});

	test("isHttpsUrl rejects a non-https protocol", () => {
		expect(isHttpsUrl("http://example.com")).toBeFalse();
		expect(isHttpsUrl("ftp://example.com")).toBeFalse();
	});

	test("isHttpsUrl rejects a bare host with no TLD-looking domain", () => {
		expect(isHttpsUrl("https://localhost")).toBeFalse();
	});

	test("isHttpsUrl rejects an unparseable URL", () => {
		expect(isHttpsUrl("https://")).toBeFalse();
	});

	test("isHttpsUrl accepts a valid https URL with a real-looking domain", () => {
		expect(isHttpsUrl("https://example.com")).toBeTrue();
	});

	test("createHttpsUrlSchema rejects a value over the max length", () => {
		const schema = createHttpsUrlSchema();
		const longValue = `https://${"a".repeat(200)}.com`;
		const result = schema.safeParse(longValue);
		expect(result.success).toBeFalse();
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe("Website URL must be shorter than 150 characters");
		}
	});

	test("createHttpsUrlSchema rejects a value containing spaces", () => {
		const schema = createHttpsUrlSchema();
		const result = schema.safeParse("example .com");
		expect(result.success).toBeFalse();
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe("Website URL cannot contain spaces");
		}
	});

	test("createHttpsUrlSchema normalizes and accepts a bare domain", () => {
		const schema = createHttpsUrlSchema();
		const result = schema.safeParse("example.com");
		expect(result.success).toBeTrue();
		if (result.success) {
			expect(result.data).toBe("https://example.com");
		}
	});

	test("createHttpsUrlSchema uses custom messages when provided", () => {
		const schema = createHttpsUrlSchema({
			tooLong: "custom too long",
			containsSpaces: "custom spaces",
			invalid: "custom invalid",
		});
		const result = schema.safeParse("not a url");
		expect(result.success).toBeFalse();
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe("custom spaces");
		}
	});
});

describe("admin GET /admin/users exercises the club dataloader batch path", () => {
	test("a user with club memberships gets club names resolved via loadMany", async () => {
		const admin = await makeAdmin(await createUser());
		const owner = await createUser();

		const countries = await api(owner.cookie).get("/api/countries");
		const countryId = countries.body[0]?.id;
		const created = await api(owner.cookie).post("/api/clubs", {
			name: `Dataloader Club ${crypto.randomUUID().slice(0, 8)}`,
			countryId,
			location: "Sarajevo",
		});
		expect(created.status).toBe(200);

		const list = await api(admin.cookie).get(`/api/admin/users?search=${encodeURIComponent(owner.email)}`);
		expect(list.status).toBe(200);
		const found = list.body.users.find((u: { id: string }) => u.id === owner.id);
		expect(found).toBeDefined();
		expect(found.clubMembership.length).toBeGreaterThanOrEqual(1);

		const detail = await api(admin.cookie).get(`/api/admin/users/${owner.id}`);
		expect(detail.status).toBe(200);
		expect(detail.body.clubMembership.length).toBeGreaterThanOrEqual(1);
	});
});
