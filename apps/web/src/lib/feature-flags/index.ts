/**
 * Feature Flags Module
 *
 * This module provides utilities for managing feature flags.
 *
 * Client-side usage:
 * ```tsx
 * import { useFeatureFlag } from '@/lib/feature-flags';
 *
 * // Feature flags are automatically fetched server-side and provided via FeatureFlagsWrapper
 * const isEnabled = useFeatureFlag('my-feature');
 * ```
 *
 * Server-side usage:
 * ```ts
 * import { getFeatureFlag } from '@/lib/feature-flags';
 *
 * const isEnabled = await getFeatureFlag('my-feature');
 * ```
 */

export type { FeatureFlags } from "./client";
// Client-side exports
export { FeatureFlagsProvider, useFeatureFlag, useFeatureFlags } from "./client";

// Flag names and types
export { createFeatureFlagName, isValidFeatureFlagName } from "./flags";
// Server-side exports
export { getFeatureFlag } from "./server";
