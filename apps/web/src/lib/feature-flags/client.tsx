"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { FeatureFlagName } from "./flags";

export type FeatureFlags = Record<string, boolean>;

interface FeatureFlagsContextValue {
	flags: FeatureFlags;
	isEnabled: (flagName: FeatureFlagName) => boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

interface FeatureFlagsProviderProps {
	children: ReactNode;
	initialFlags: FeatureFlags;
}

/**
 * Feature Flags Provider
 * Provides feature flags to the entire application
 */
export function FeatureFlagsProvider({ children, initialFlags }: FeatureFlagsProviderProps) {
	const isEnabled = (flagName: FeatureFlagName): boolean => {
		return initialFlags[flagName] === true;
	};

	return (
		<FeatureFlagsContext.Provider value={{ flags: initialFlags, isEnabled }}>
			{children}
		</FeatureFlagsContext.Provider>
	);
}

/**
 * Hook to access feature flags in client components
 * @returns Feature flags context with helper functions
 * @throws Error if used outside FeatureFlagsProvider
 */
export function useFeatureFlags(): FeatureFlagsContextValue {
	const context = useContext(FeatureFlagsContext);
	if (context === undefined) {
		throw new Error("useFeatureFlags must be used within a FeatureFlagsProvider");
	}
	return context;
}

/**
 * Hook to check if a specific feature is enabled (client-side)
 * @param flagName - The name of the feature flag (must be UPPERCASE_WITH_UNDERSCORES)
 * @returns true if enabled, false otherwise
 */
export function useFeatureFlag(flagName: FeatureFlagName): boolean {
	const { isEnabled } = useFeatureFlags();
	return isEnabled(flagName);
}
