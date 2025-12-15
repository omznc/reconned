import { db } from "./db";

/**
 * Simple DataLoader implementation to batch database queries and eliminate N+1 problems
 * This is a basic implementation - for production use, consider a more robust library
 */
export class DataLoader<TKey, TValue> {
	private cache = new Map<TKey, TValue>();
	private pending = new Map<TKey, Promise<TValue>>();
	private batchLoadFn: (keys: TKey[]) => Promise<Map<TKey, TValue>>;

	constructor(batchLoadFn: (keys: TKey[]) => Promise<Map<TKey, TValue>>) {
		this.batchLoadFn = batchLoadFn;
	}

	async load(key: TKey): Promise<TValue> {
		const cached = this.cache.get(key);
		if (cached !== undefined) {
			return cached;
		}

		const pending = this.pending.get(key);
		if (pending !== undefined) {
			return pending;
		}

		const promise = this.batchLoadFn([key]).then((results) => {
			const value = results.get(key);
			if (value === undefined) {
				throw new Error(`No result found for key: ${key}`);
			}
			this.cache.set(key, value);
			this.pending.delete(key);
			return value;
		});

		this.pending.set(key, promise);
		return promise;
	}

	async loadMany(keys: TKey[]): Promise<Map<TKey, TValue>> {
		const results = new Map<TKey, TValue>();
		const uncachedKeys: TKey[] = [];

		for (const key of keys) {
			const cached = this.cache.get(key);
			if (cached !== undefined) {
				results.set(key, cached);
			} else {
				// For pending requests, we refetch rather than wait to keep it simple
				// This avoids complex promise coordination but may result in duplicate queries
				uncachedKeys.push(key);
			}
		}

		if (uncachedKeys.length > 0) {
			const batchResults = await this.batchLoadFn(uncachedKeys);

			for (const [key, value] of batchResults) {
				this.cache.set(key, value);
				results.set(key, value);
			}
		}

		return results;
	}

	clear(key?: TKey): void {
		if (key !== undefined) {
			this.cache.delete(key);
			this.pending.delete(key);
		} else {
			this.cache.clear();
			this.pending.clear();
		}
	}
}

/**
 * Create a DataLoader for batching database queries by ID
 */
export function createIdDataLoader<TTable, TKey extends string | number, TValue>(
	selectFn: (ids: TKey[]) => Promise<TTable[]>,
	getId: (item: TTable) => TKey,
	transform?: (item: TTable) => TValue,
): DataLoader<TKey, TValue> {
	return new DataLoader<TKey, TValue>(async (keys: TKey[]) => {
		const results = await selectFn(keys);
		const map = new Map<TKey, TValue>();

		for (const result of results) {
			const id = getId(result);
			const value = transform ? transform(result) : (result as unknown as TValue);
			map.set(id, value);
		}

		return map;
	});
}

/**
 * Common DataLoaders for the application
 */
export const createClubDataLoader = () => {
	return createIdDataLoader(
		async (ids: string[]) => {
			const { club } = await import("../drizzle/schema");
			const { inArray } = await import("drizzle-orm");

			return db.select().from(club).where(inArray(club.id, ids));
		},
		(club) => club.id,
		(club): { name: string } => ({ name: club.name }),
	);
};

export const createUserDataLoader = () => {
	return createIdDataLoader(
		async (ids: string[]) => {
			const { user } = await import("../drizzle/schema");
			const { inArray } = await import("drizzle-orm");

			return db.select().from(user).where(inArray(user.id, ids));
		},
		(user) => user.id,
	);
};

/**
 * Batch loading utility for relationships
 * Eliminates N+1 queries when loading related data
 */
export async function batchLoadRelationships<
	TParent,
	TParentKey extends string | number,
	TRelated,
	TRelatedKey extends string | number,
>(
	parents: TParent[],
	getParentKey: (parent: TParent) => TParentKey,
	getRelatedKeys: (parent: TParent) => TRelatedKey[],
	loadRelated: (keys: TRelatedKey[]) => Promise<TRelated[]>,
	getRelatedKey: (related: TRelated) => TRelatedKey,
	transform?: (parent: TParent, related: TRelated[]) => unknown,
): Promise<Map<TParentKey, unknown>> {
	const relatedKeysSet = new Set<TRelatedKey>();

	for (const parent of parents) {
		const keys = getRelatedKeys(parent);
		for (const key of keys) {
			relatedKeysSet.add(key);
		}
	}

	const relatedKeys = Array.from(relatedKeysSet);
	const relatedItems = await loadRelated(relatedKeys);

	const relatedByKey = new Map<TRelatedKey, TRelated>();
	for (const item of relatedItems) {
		relatedByKey.set(getRelatedKey(item), item);
	}

	const results = new Map<TParentKey, unknown>();

	for (const parent of parents) {
		const parentKey = getParentKey(parent);
		const parentRelatedKeys = getRelatedKeys(parent);
		const parentRelatedItems = parentRelatedKeys
			.map((key) => relatedByKey.get(key))
			.filter((item): item is TRelated => item !== undefined);

		results.set(parentKey, transform ? transform(parent, parentRelatedItems) : parentRelatedItems);
	}

	return results;
}
