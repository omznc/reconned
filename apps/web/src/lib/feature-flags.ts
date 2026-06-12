import "server-only";
import apiServer from "./api/api";

let cachedFlags: Array<{ name: string; enabled: boolean }> | null = null;
let cachedFlagsPromise: Promise<Array<{ name: string; enabled: boolean }>> | null = null;
let cachedFlagsTimestamp = 0;
const CACHE_TTL = 300_000;

/**
 * Check if a feature flag is enabled
 */
export async function isFeatureEnabled(flagName: string): Promise<boolean> {
	if (!cachedFlags || Date.now() - cachedFlagsTimestamp > CACHE_TTL) {
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
		cachedFlagsTimestamp = Date.now();
	}

	const flag = cachedFlags.find((f) => f.name === flagName);
	return flag?.enabled ?? false;
}

export function resetFeatureFlagsCache(): void {
	cachedFlags = null;
	cachedFlagsPromise = null;
	cachedFlagsTimestamp = 0;
}
