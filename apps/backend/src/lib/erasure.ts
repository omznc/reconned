import { env } from "./env";
import { logger } from "./posthog";

// A processor that hangs must not hold the request open: the database work is already committed
// by the time these run, so a stalled call delays a response about an erasure that has happened.
const PROCESSOR_TIMEOUT_MS = 10_000;

/**
 * Erasure of personal data held by third-party processors — Art. 19.
 *
 * These run *after* the deletion transaction commits and are best-effort: a processor being down
 * must not roll back an erasure the database has already carried out. Failures are logged loudly
 * so they can be retried by hand, since a silent one is an ongoing breach.
 */

/**
 * Removes the person profile and every event attached to it. `delete_events=true` matters: without
 * it the events remain, so a deleted account's behavioural history stays queryable. Async on
 * PostHog's side.
 */
export async function deletePosthogPerson(userId: string): Promise<boolean> {
	const apiKey = env.POSTHOG_PERSONAL_API_KEY;
	const projectIds = env.POSTHOG_PROJECT_IDS;

	if (!apiKey || !projectIds?.length) {
		logger.emit({
			severityText: "warn",
			body: "PostHog person erasure skipped: not configured",
			attributes: {
				outcome: "error",
				business: {
					operation: "erase_posthog_person",
					domain: "privacy",
					user_id: userId,
					reason: "POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_IDS unset",
				},
			},
		});
		return false;
	}

	// One failure fails the call: a partial success still leaves personal data behind.
	const results = await Promise.all(projectIds.map((projectId) => deleteFromProject(apiKey, projectId, userId)));

	return results.every(Boolean);
}

async function deleteFromProject(apiKey: string, projectId: string, userId: string): Promise<boolean> {
	try {
		// By distinct id, which is what we capture against; the per-person endpoint wants PostHog's
		// own UUID and a lookup round-trip.
		const response = await fetch(
			`${env.POSTHOG_API_HOST}/api/projects/${projectId}/persons/bulk_delete/?delete_events=true`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ distinct_ids: [userId] }),
				signal: AbortSignal.timeout(PROCESSOR_TIMEOUT_MS),
			},
		);

		if (!response.ok) {
			logger.emit({
				severityText: "error",
				body: "PostHog person erasure failed",
				attributes: {
					outcome: "error",
					status_code: response.status,
					business: {
						operation: "erase_posthog_person",
						domain: "privacy",
						user_id: userId,
						project_id: projectId,
						response: await response.text().catch(() => ""),
					},
				},
			});
			return false;
		}

		return true;
	} catch (error) {
		logger.emit({
			severityText: "error",
			body: "PostHog person erasure threw",
			attributes: {
				outcome: "error",
				error: {
					message: error instanceof Error ? error.message : String(error),
					type: error instanceof Error ? error.name : "unknown",
				},
				business: {
					operation: "erase_posthog_person",
					domain: "privacy",
					user_id: userId,
					project_id: projectId,
				},
			},
		});
		return false;
	}
}

/**
 * Deletes the OneSignal user and every email subscription attached to them. Addressed by
 * `external_id` — there is no delete-by-email endpoint and we never see the subscription id.
 *
 * **A no-op today:** `sendEmail` uses `include_email_tokens` (see `mail.ts`), which attaches
 * subscriptions to an *anonymous* user with no alias to match. Wired up now so the path is correct
 * the moment `mail.ts` starts identifying users at send time.
 */
export async function deleteOnesignalUser(userId: string): Promise<boolean> {
	// Same signal `mail.ts` sends on: an environment that never sends email has no OneSignal user
	// to erase, and the credentials it does hold are placeholders. Without this the test suite
	// makes a live call to OneSignal on every account deletion, which is both a 10s timeout per
	// test on an offline runner and a request no test run should be making.
	if (process.env.EMAIL_DISABLED === "true") {
		return true;
	}

	try {
		const response = await fetch(
			`https://api.onesignal.com/apps/${env.ONESIGNAL_APP_ID}/users/by/external_id/${encodeURIComponent(userId)}`,
			{
				method: "DELETE",
				headers: { Authorization: `Key ${env.ONESIGNAL_API_KEY}` },
				signal: AbortSignal.timeout(PROCESSOR_TIMEOUT_MS),
			},
		);

		// 404 is expected while no alias is set, and for a user who never received an email.
		if (!response.ok && response.status !== 404) {
			logger.emit({
				severityText: "error",
				body: "OneSignal user erasure failed",
				attributes: {
					outcome: "error",
					status_code: response.status,
					business: {
						operation: "erase_onesignal_user",
						domain: "privacy",
						user_id: userId,
						response: await response.text().catch(() => ""),
					},
				},
			});
			return false;
		}

		return true;
	} catch (error) {
		logger.emit({
			severityText: "error",
			body: "OneSignal user erasure threw",
			attributes: {
				outcome: "error",
				error: {
					message: error instanceof Error ? error.message : String(error),
					type: error instanceof Error ? error.name : "unknown",
				},
				business: { operation: "erase_onesignal_user", domain: "privacy", user_id: userId },
			},
		});
		return false;
	}
}
