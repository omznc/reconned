import "server-only";

import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { env } from "@/lib/env";

export type FeatureFlag = ApiResponse<"/api/public/feature-flags", "get">["featureFlags"][number];

/** How long the in-process flag list may be served, in milliseconds. */
const FEATURE_FLAGS_TTL_MS = 5 * 60 * 1000;

const backendBaseUrl = env.NEXT_PUBLIC_BACKEND_URL?.trim().replace(/\/+$/, "");

// shortcut: per-process TTL map, no cross-instance invalidation after admin flag edits, move to Redis if flags must flip instantly
let cached: { flags: FeatureFlag[]; expiresAt: number } | undefined;

async function fetchFeatureFlags(): Promise<FeatureFlag[] | undefined> {
	if (!backendBaseUrl) {
		return [];
	}

	try {
		const response = await fetch(`${backendBaseUrl}/api/public/feature-flags`, {
			headers: env.INTERNAL_API_SECRET ? { "x-internal-api-secret": env.INTERNAL_API_SECRET } : undefined,
		});

		if (!response.ok) {
			console.error("Failed to fetch feature flags:", response.status, response.statusText);
			return undefined;
		}

		const body = (await response.json()) as ApiResponse<"/api/public/feature-flags", "get">;
		return body?.featureFlags ?? [];
	} catch (error) {
		console.error("Error fetching feature flags:", error);
		return undefined;
	}
}

/**
 * Fetch the public feature-flag list.
 *
 * Deliberately uses a raw `fetch` instead of `apiServer`: the endpoint is public, so the
 * caller's cookies must not be forwarded. Failures are not cached; they answer with no flags.
 */
export async function getFeatureFlags(): Promise<FeatureFlag[]> {
	if (cached && cached.expiresAt > Date.now()) {
		return cached.flags;
	}

	const flags = await fetchFeatureFlags();
	if (!flags) {
		return cached?.flags ?? [];
	}
	cached = { flags, expiresAt: Date.now() + FEATURE_FLAGS_TTL_MS };
	return flags;
}

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
