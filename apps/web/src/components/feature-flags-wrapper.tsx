import type { ReactNode } from "react";
import { type FeatureFlags, FeatureFlagsProvider } from "@/lib/feature-flags/client";
import { getFeatureFlags } from "@/lib/feature-flags/server";

interface FeatureFlagsWrapperProps {
	children: ReactNode;
}

/**
 * Wrapper component that fetches feature flags server-side
 * and provides them to the client-side FeatureFlagsProvider.
 *
 * Uses the shared, cached `getFeatureFlags()` so this does not add an uncached
 * backend round-trip to every page render.
 */
export async function FeatureFlagsWrapper({ children }: FeatureFlagsWrapperProps) {
	const featureFlags = await getFeatureFlags();

	// Convert array to object for easier lookup
	const flags: FeatureFlags = {};
	for (const flag of featureFlags) {
		flags[flag.name] = flag.enabled;
	}

	return <FeatureFlagsProvider initialFlags={flags}>{children}</FeatureFlagsProvider>;
}
