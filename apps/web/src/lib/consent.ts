/**
 * Analytics consent.
 *
 * Analytics is the one thing on this platform that runs on consent rather than
 * on contract, so it has to be genuinely opt-in: nothing is loaded, no cookie is
 * set and no request leaves the browser until the user says yes, and saying no
 * later has to be as easy as saying yes did.
 *
 * The stored decision is deliberately a record rather than a bare boolean — we
 * have to be able to show *when* consent was given and *what* it was given
 * against, not just that it exists. Its shape lives in `consent-storage.ts` and
 * is re-exported here, so callers only need this module.
 */

import posthog from "posthog-js";
import { CONSENT_POLICY_VERSION, CONSENT_STORAGE_KEY, type ConsentRecord } from "./consent-storage";

export { CONSENT_POLICY_VERSION, CONSENT_STORAGE_KEY, type ConsentRecord };

/** Fired after a decision is stored, so any open UI can re-read it. */
export const CONSENT_CHANGED_EVENT = "reconned:consent-changed";

/** Fired to reopen the banner — this is what the footer's "Cookie settings" does. */
export const CONSENT_OPEN_EVENT = "reconned:consent-open";

const POSTHOG_PUBLIC_KEY =
	process.env.NODE_ENV === "development" ? "" : "phc_Til0zz9j32sG49ojKjcns9mPsrj03jR0yQCX38uOeb1";

let initialised = false;

export function readConsent(): ConsentRecord | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
		if (!raw) {
			return null;
		}

		const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
		// Every field has to be present and current. A record without a usable
		// timestamp is not evidence of anything — substituting "now" would date the
		// consent to the moment we happened to read it, so it counts as no decision
		// and the banner asks again.
		if (
			typeof parsed.analytics !== "boolean" ||
			typeof parsed.timestamp !== "string" ||
			parsed.policyVersion !== CONSENT_POLICY_VERSION
		) {
			return null;
		}

		return {
			analytics: parsed.analytics,
			timestamp: parsed.timestamp,
			policyVersion: CONSENT_POLICY_VERSION,
		};
	} catch {
		// Storage blocked or the value is corrupt — treat it as no decision made.
		return null;
	}
}

/**
 * Records a decision and acts on it immediately. Withdrawal takes effect in the
 * same tab without a reload; waiting for the next navigation would mean
 * capturing events the user has just said no to.
 */
export function setConsent(analytics: boolean): ConsentRecord {
	const record: ConsentRecord = {
		analytics,
		timestamp: new Date().toISOString(),
		policyVersion: CONSENT_POLICY_VERSION,
	};

	try {
		window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
	} catch {
		// Non-fatal: the decision still applies for this page load.
	}

	applyConsent(analytics);
	window.dispatchEvent(new CustomEvent<ConsentRecord>(CONSENT_CHANGED_EVENT, { detail: record }));

	return record;
}

/** Called from `instrumentation-client.ts` so consenting users are tracked from the first paint. */
export function applyStoredConsent(): void {
	const stored = readConsent();
	if (stored?.analytics) {
		applyConsent(true);
	}
}

export function applyConsent(analytics: boolean): void {
	if (typeof window === "undefined") {
		return;
	}

	if (analytics) {
		initPosthog();
		if (initialised) {
			posthog.opt_in_capturing();
		}
		return;
	}

	if (initialised) {
		posthog.opt_out_capturing();
		posthog.reset();
	}

	clearPosthogStorage();
}

function initPosthog(): void {
	// No key in development — skip entirely rather than initialising a client
	// that can only fail.
	if (initialised || !POSTHOG_PUBLIC_KEY) {
		return;
	}

	posthog.init(POSTHOG_PUBLIC_KEY, {
		api_host: "/warmind",
		ui_host: "https://eu.posthog.com",
		defaults: "2025-05-24",
		capture_exceptions: true,
		// Session replay is enabled and the banner says so. These values are all
		// PostHog's current defaults, pinned here on purpose: they are the
		// settings whose meaning is "we do not record what people type or what
		// their browser sends", and a library default silently changing is not
		// something we want to find out about from a recording.
		//
		// Text is masked by the default `ph-mask` class and elements are dropped
		// entirely by the default `ph-no-capture` class. Anywhere the UI renders
		// someone's email or phone number should carry one of those.
		session_recording: {
			maskAllInputs: true,
			recordHeaders: false,
			recordBody: false,
		},
		enable_recording_console_log: false,
	});
	initialised = true;
}

/**
 * `opt_out_capturing()` stops new events but leaves the identifiers PostHog has
 * already written. Clearing them is the difference between "we stopped
 * collecting" and "we stopped collecting and forgot who you were".
 */
function clearPosthogStorage(): void {
	for (const entry of document.cookie.split(";")) {
		const name = entry.split("=")[0]?.trim();
		if (name?.startsWith("ph_")) {
			document.cookie = `${name}=; path=/; max-age=0`;
		}
	}

	try {
		for (const key of Object.keys(window.localStorage)) {
			if (key.startsWith("ph_")) {
				window.localStorage.removeItem(key);
			}
		}
	} catch {
		// Storage blocked — nothing was written in the first place.
	}
}

/**
 * Whether PostHog is actually running. Capture calls made before `init()` are
 * harmless no-ops, but callers that would otherwise do work to build an event
 * payload can skip it.
 */
export function isAnalyticsEnabled(): boolean {
	return initialised;
}

export function openConsentSettings(): void {
	window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
