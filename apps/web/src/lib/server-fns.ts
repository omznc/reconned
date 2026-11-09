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

type CommitInfo = { commit: string; date: string } | null;

let commitInfo: { value: CommitInfo } | undefined;

/**
 * The running commit and its committer date, for the footer. Fetched once per process.
 * The commit comes from here, not from the browser bundle, so the server and the client render the same text.
 */
export const getCommitDateFn = createServerFn({ method: "GET" }).handler(async (): Promise<CommitInfo> => {
	if (commitInfo) {
		return commitInfo.value;
	}
	const commit = process.env.NEXT_PUBLIC_SOURCE_COMMIT || process.env.SOURCE_COMMIT;
	if (!commit) {
		return null;
	}
	try {
		const response = await fetch(`https://api.github.com/repos/omznc/reconned/commits/${commit}`);
		const body = (await response.json()) as { commit?: { committer?: { date?: string } } };
		const date = body.commit?.committer?.date;
		commitInfo = { value: date ? { commit, date } : null };
	} catch {
		return null;
	}
	return commitInfo.value;
});
