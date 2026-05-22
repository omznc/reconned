import "server-only";
import apiServer from "./api/api";

let cachedFlags: Array<{ name: string; enabled: boolean }> | null = null;
let cachedFlagsPromise: Promise<Array<{ name: string; enabled: boolean }>> | null = null;

/**
 * Check if a feature flag is enabled
 */
export async function isFeatureEnabled(flagName: string): Promise<boolean> {
	if (!cachedFlags) {
		if (!cachedFlagsPromise) {
			cachedFlagsPromise = apiServer
				.GET("/api/public/feature-flags")
				.then((response) => {
					if (response.error) {
						console.error("Error fetching feature flags:", response);
						return [];
					}
					return response?.data?.featureFlags ?? [];
				})
				.finally(() => {
					cachedFlagsPromise = null;
				});
		}

		const flags = await cachedFlagsPromise;
		cachedFlags = flags;
	}

	const flag = cachedFlags.find((f) => f.name === flagName);
	return flag?.enabled ?? false;
}

export function resetFeatureFlagsCache(): void {
	cachedFlags = null;
	cachedFlagsPromise = null;
}
