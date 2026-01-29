import "server-only";
import apiServer from "./api/api";

/**
 * Check if a feature flag is enabled
 */
export async function isFeatureEnabled(flagName: string): Promise<boolean> {
	const response = await apiServer.GET("/api/public/feature-flags");

	if (response.error) {
		console.error("Error fetching feature flags:", response);
		return false;
	}

	const flags = response?.data.featureFlags;
	const flag = flags.find((f) => f.name === flagName);

	return flag?.enabled ?? false;
}
