import "server-only";

/**
 * Re-export shim for the single canonical feature-flag implementation.
 *
 * The real implementation lives in `@/lib/feature-flags/server`. This file is kept
 * so the many existing `@/lib/feature-flags` importers keep working.
 */
export {
	FEATURE_FLAGS_CACHE_TAG,
	type FeatureFlag,
	getFeatureFlags,
	isFeatureEnabled,
} from "./feature-flags/server";
