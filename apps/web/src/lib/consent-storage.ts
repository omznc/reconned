/**
 * The stored shape of an analytics consent decision.
 *
 * Split out from `consent.ts` so it can be read by things that must not pull in
 * `posthog-js` — notably the Playwright setup, which seeds a decision so the
 * banner does not sit over the UI the specs are trying to click.
 */

export const CONSENT_STORAGE_KEY = "reconned.consent";

/**
 * Bump this whenever the privacy policy changes what analytics consent actually
 * covers. A decision recorded against an older version is treated as absent, so
 * the banner asks again rather than silently carrying the old answer forward.
 */
export const CONSENT_POLICY_VERSION = "2026-08-04";

export interface ConsentRecord {
	analytics: boolean;
	timestamp: string;
	policyVersion: string;
}
