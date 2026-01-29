import type { ReactNode } from "react";
import apiPublic from "@/lib/api/api-public";
import { type FeatureFlags, FeatureFlagsProvider } from "@/lib/feature-flags/client";

interface FeatureFlagsWrapperProps {
	children: ReactNode;
}

/**
 * Wrapper component that fetches feature flags server-side
 * and provides them to the client-side FeatureFlagsProvider
 */
export async function FeatureFlagsWrapper({ children }: FeatureFlagsWrapperProps) {
	const response = await apiPublic.GET("/api/public/feature-flags");

	const flags: FeatureFlags = {};
	if (response.data) {
		// Convert array to object for easier lookup
		for (const flag of response.data.featureFlags) {
			flags[flag.name] = flag.enabled;
		}
	}

	return <FeatureFlagsProvider initialFlags={flags}>{children}</FeatureFlagsProvider>;
}
