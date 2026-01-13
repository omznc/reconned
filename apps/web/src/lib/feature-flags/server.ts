import "server-only";
import apiPublic from "@/lib/api/api-public";
import type { FeatureFlagName } from "./flags";

/**
 * Server-side function to check if a specific feature is enabled
 * @param flagName - The name of the feature flag (must be UPPERCASE_WITH_UNDERSCORES)
 * @returns true if enabled, false otherwise
 */
export async function getFeatureFlag(flagName: FeatureFlagName): Promise<boolean> {
	try {
		const response = await apiPublic.GET("/api/public/feature-flags");

		if (!response.data) {
			console.error("Failed to fetch feature flags");
			return false;
		}

		const flag = response.data.featureFlags?.find((f) => f.name === flagName);
		return flag?.enabled === true;
	} catch (error) {
		console.error("Error fetching feature flag:", error);
		return false;
	}
}
