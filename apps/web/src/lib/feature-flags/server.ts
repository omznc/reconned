import "server-only";

import { cache } from "react";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { env } from "@/lib/env";

export type FeatureFlag = ApiResponse<"/api/public/feature-flags", "get">["featureFlags"][number];

/** Cache tag for the public feature-flag list. Revalidate it after admin flag mutations. */
export const FEATURE_FLAGS_CACHE_TAG = "feature-flags";

/** How long the shared data cache may serve a stale flag list, in seconds. */
const FEATURE_FLAGS_REVALIDATE = 300;

const backendBaseUrl = env.NEXT_PUBLIC_BACKEND_URL?.trim().replace(/\/+$/, "");

/**
 * Fetch the public feature-flag list.
 *
 * Deliberately uses a raw `fetch` instead of the openapi-fetch clients:
 * - `apiServer` forwards the incoming request's cookies, which both pollutes the
 *   shared data cache key and is unnecessary for a public endpoint.
 * - `apiPublic` drops `next` options, so it cannot be cached at all.
 *
 * Wrapped in React `cache()` so a single render only ever awaits one promise,
 * and cached in Next's shared data cache across requests (the payload is public
 * and identical for every viewer, so this is safe).
 */
export const getFeatureFlags = cache(async (): Promise<FeatureFlag[]> => {
	if (!backendBaseUrl) {
		return [];
	}

	try {
		const response = await fetch(`${backendBaseUrl}/api/public/feature-flags`, {
			headers: env.INTERNAL_API_SECRET ? { "x-internal-api-secret": env.INTERNAL_API_SECRET } : undefined,
			next: {
				revalidate: FEATURE_FLAGS_REVALIDATE,
				tags: [FEATURE_FLAGS_CACHE_TAG],
			},
		});

		if (!response.ok) {
			console.error("Failed to fetch feature flags:", response.status, response.statusText);
			return [];
		}

		const body = (await response.json()) as ApiResponse<"/api/public/feature-flags", "get">;
		return body?.featureFlags ?? [];
	} catch (error) {
		console.error("Error fetching feature flags:", error);
		return [];
	}
});

/**
 * Server-side check for whether a specific feature is enabled.
 * @param flagName - The name of the feature flag (UPPERCASE_WITH_UNDERSCORES by convention).
 *
 * Note: typed as `string` rather than `FeatureFlagName` — `ScreamingSnakeCase<string>`
 * collapses to `never` for non-literal inputs, so using it here rejects every call site.
 */
export async function isFeatureEnabled(flagName: string): Promise<boolean> {
	const flags = await getFeatureFlags();
	return flags.find((flag) => flag.name === flagName)?.enabled === true;
}
