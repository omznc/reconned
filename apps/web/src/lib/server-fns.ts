import { createServerFn } from "@tanstack/react-start";
import { isAuthenticated } from "@/lib/auth";
import { getFeatureFlags } from "@/lib/feature-flags/server";

/** The signed-in user, or `null`. Fails closed. Used by the `{-$locale}` route `beforeLoad`. */
export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
	return await isAuthenticated();
});

/** Public feature flags as a name -> enabled map. */
export const getFeatureFlagsFn = createServerFn({ method: "GET" }).handler(async () => {
	const flags: Record<string, boolean> = {};
	for (const flag of await getFeatureFlags()) {
		flags[flag.name] = flag.enabled;
	}
	return flags;
});

let commitDate: { value: string | null } | undefined;

/** Committer date of the running commit, for the footer. Fetched once per process. */
export const getCommitDateFn = createServerFn({ method: "GET" }).handler(async () => {
	if (commitDate) {
		return commitDate.value;
	}
	const commit = process.env.NEXT_PUBLIC_SOURCE_COMMIT || process.env.SOURCE_COMMIT;
	if (!commit) {
		return null;
	}
	try {
		const response = await fetch(`https://api.github.com/repos/omznc/reconned/commits/${commit}`);
		const body = (await response.json()) as { commit?: { committer?: { date?: string } } };
		commitDate = { value: body.commit?.committer?.date ?? null };
	} catch {
		return null;
	}
	return commitDate.value;
});
