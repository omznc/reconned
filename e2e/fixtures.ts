import { readFileSync } from "node:fs";
import path from "node:path";
import { CONSENT_POLICY_VERSION, CONSENT_STORAGE_KEY, type ConsentRecord } from "../apps/web/src/lib/consent-storage";

export const BACKEND_URL = "http://localhost:3202";
export const WEB_URL = "http://localhost:3100";
export const authDir = path.join(__dirname, ".auth");

/**
 * A pre-recorded "no analytics" decision, seeded into every project's storage
 * state. Without it the consent banner is up on first paint on every page, and
 * it sits over the bottom of the viewport where the submit buttons are — specs
 * fail on "intercepts pointer events" rather than on anything they test.
 *
 * The constants are imported rather than copied so a policy-version bump can't
 * silently invalidate the seeded record and bring the banner back.
 */
export function consentOrigin(analytics = false) {
	const record: ConsentRecord = {
		analytics,
		timestamp: new Date(0).toISOString(),
		policyVersion: CONSENT_POLICY_VERSION,
	};

	return {
		origin: WEB_URL,
		localStorage: [{ name: CONSENT_STORAGE_KEY, value: JSON.stringify(record) }],
	};
}

export interface Fixtures {
	user: { email: string; password: string; name: string };
	event: { id: string; name: string };
	club: { id: string; name: string };
}

/** Fixture data written by global-setup, read by the specs. */
export function loadFixtures(): Fixtures {
	return JSON.parse(readFileSync(path.join(authDir, "fixtures.json"), "utf8"));
}
