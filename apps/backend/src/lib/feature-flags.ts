import { eq } from "drizzle-orm";
import { featureFlag } from "../drizzle/schema";
import { db } from "./db";
import { redis } from "./redis";

const CACHE_KEY_PREFIX = "feature_flag:";
const CACHE_TTL = 60;

export async function isFeatureEnabled(flagName: string): Promise<boolean> {
	const cacheKey = `${CACHE_KEY_PREFIX}${flagName}`;

	try {
		const cached = await redis.get(cacheKey);
		if (cached !== null) {
			return cached === "1" || cached === "true";
		}

		const flag = await db
			.select({ enabled: featureFlag.enabled })
			.from(featureFlag)
			.where(eq(featureFlag.name, flagName))
			.limit(1);

		const enabled = flag[0]?.enabled ?? false;

		await redis.setex(cacheKey, CACHE_TTL, enabled ? "1" : "0");

		return enabled;
	} catch (error) {
		console.error(`Error checking feature flag "${flagName}":`, error);
		return false;
	}
}

export async function getEnabledFlags(): Promise<Record<string, boolean>> {
	try {
		const flags = await db
			.select({ name: featureFlag.name, enabled: featureFlag.enabled })
			.from(featureFlag)
			.where(eq(featureFlag.enabled, true));

		const result: Record<string, boolean> = {};
		for (const flag of flags) {
			result[flag.name] = flag.enabled;
		}

		return result;
	} catch (error) {
		console.error("Error fetching enabled flags:", error);
		return {};
	}
}

export async function clearFeatureFlagsCache(flagName?: string): Promise<void> {
	try {
		if (flagName) {
			await redis.del(`${CACHE_KEY_PREFIX}${flagName}`);
		} else {
			const keys = await redis.keys(`${CACHE_KEY_PREFIX}*`);
			if (keys.length > 0) {
				await redis.del(...keys);
			}
		}
	} catch (error) {
		console.error("Error clearing feature flags cache:", error);
	}
}
