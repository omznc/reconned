/**
 * Storage limitation — Art. 7(1)(e) ZZLP / Art. 5(1)(e) GDPR.
 *
 * Deliberately dependency-free, in the same spirit as `validation-contracts`: the privacy policy
 * has to state these periods (Art. 15(2)(a)) and it lives in the web app, so the numbers have to be
 * importable without dragging the database client across the boundary with them. `tasks/retention`
 * enforces them; this module is only what they are.
 *
 * A policy promising 30 days over code that keeps forever is a false statement to data subjects,
 * so the published figure is rendered *from* these constants rather than typed alongside them —
 * changing one here changes the policy in the same commit, by construction.
 *
 * **Accounts have no scheduled expiry, by decision.** An account someone can still log into is
 * still serving its purpose, so "for as long as the account exists" is the stated period and
 * deletion stays user-triggered. No dormancy reaper: auto-deleting an idle account would destroy
 * club rosters, attendance history and reviews written about *other* people. See §6.1 of
 * `docs/PLAN.md`.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

const days = (n: number) => n * DAY_MS;

export const RETENTION = {
	/** A `Session` row holds an IP and user agent, and once expired it authenticates nothing. The
	 * tail leaves "was this really me?" answerable for a month. */
	EXPIRED_SESSION: days(30),

	/** Password resets and email confirmations: a live credential until expiry, dead weight after. */
	EXPIRED_VERIFICATION: days(7),

	/**
	 * The action record itself is kept indefinitely for club governance; the network identifiers
	 * only serve abuse investigation, which is a question asked within weeks. Nothing writes these
	 * columns today, so this holds the line rather than remediating anything — see T2.2.
	 */
	AUDIT_LOG_NETWORK_IDENTIFIERS: days(90),
} as const;

/** Whole days, for the published figure. Every period is a whole number of days by construction. */
export function retentionDays(period: number): number {
	return Math.round(period / DAY_MS);
}

/** Periods in the shape the ROPA needs, so it can be checked against code rather than memory. */
export function describeRetention(): Array<{ data: string; period: string }> {
	return [
		{ data: "Account and profile data", period: "For as long as the account exists" },
		{
			data: "Expired sessions (including IP address and user agent)",
			period: `${retentionDays(RETENTION.EXPIRED_SESSION)} days`,
		},
		{
			data: "Expired verification tokens",
			period: `${retentionDays(RETENTION.EXPIRED_VERIFICATION)} days`,
		},
		{
			data: "IP address and user agent on club audit entries",
			period: `${retentionDays(RETENTION.AUDIT_LOG_NETWORK_IDENTIFIERS)} days`,
		},
	];
}
