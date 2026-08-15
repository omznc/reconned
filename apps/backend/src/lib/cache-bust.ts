import { deleteKeysByPattern } from "./cache";
import { logger } from "./posthog";

/**
 * The prefix the router builds its cache keys with — see `cache.keyPrefix` in `src/index.ts`.
 * Kept in sync by hand because the router owns the prefix and doesn't export it.
 */
const ROUTE_CACHE_PREFIX = "route:";

/**
 * Drops every cached response under a set of route-cache keys.
 *
 * Prefer the declarative `bustCache: [...]` route option. This exists for the handlers whose
 * bust target isn't derivable from the route's own params — e.g. accepting an invite is keyed
 * by invite code, but the membership it creates invalidates a *club's* member list.
 */
export async function bustRouteCache(keys: string[]): Promise<void> {
	await Promise.all(
		keys.map(async (key) => {
			try {
				await deleteKeysByPattern(`${ROUTE_CACHE_PREFIX}${key}:*`);
			} catch {
				// A failed bust means a stale read until the TTL expires, never a failed request.
			}
		}),
	);
}

/** Everything that changes when a club's membership list changes. */
export function clubMembershipCacheKeys(clubId: string): string[] {
	return ["clubs", `club:${clubId}`];
}

/** The route-cache key whose reads carry a review target's rating. */
const REVIEW_TARGET_CACHE_KEY: Record<string, (entityId: string) => string> = {
	user: (id) => `user:${id}`,
	club: (id) => `club:${id}`,
	event: (id) => `event:${id}`,
};

/**
 * Drops both caches a review lands in: the reviews router's own paginated `reviews:*` entries,
 * and the route cache for the thing being reviewed, whose reads carry its rating.
 *
 * `type` is the lowercase target kind — "user", "club" or "event".
 */
export async function bustReviewCache(type: string, entityId: string): Promise<void> {
	try {
		// SCAN, not KEYS: `KEYS` is O(keyspace) and blocks the whole server while it runs.
		await deleteKeysByPattern(`reviews:${type}:${entityId}:page:*`);
	} catch (error) {
		logger.emit({
			severityText: "error",
			body: "Error busting review cache",
			attributes: { error: error instanceof Error ? error.message : String(error) },
		});
	}

	const targetKey = REVIEW_TARGET_CACHE_KEY[type]?.(entityId);
	if (targetKey) {
		await bustRouteCache([targetKey]);
	}
}
