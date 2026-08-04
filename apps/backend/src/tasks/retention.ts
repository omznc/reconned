import { and, isNotNull, lt, or } from "drizzle-orm";
import { clubAuditLog, session, verification } from "../drizzle/schema";
import { db } from "../lib/db";

// Not `TimeIntervals` from `./scheduler`: that module imports this one, and `RETENTION` is
// evaluated at import time, so borrowing a const across the cycle would hit the TDZ.
const DAY = 24 * 60 * 60 * 1000;
const days = (n: number) => n * DAY;

/**
 * Storage limitation — Art. 7(1)(e) ZZLP / Art. 5(1)(e) GDPR.
 *
 * These numbers are quoted verbatim by the privacy policy (Art. 15(2)(a)) and the ROPA
 * (Art. 32(1)(f)). Changing one here means changing those in the same commit — a policy promising
 * 30 days over code that keeps forever is a false statement to data subjects.
 *
 * **Accounts have no scheduled expiry, by decision.** An account someone can still log into is
 * still serving its purpose, so "for as long as the account exists" is the stated period and
 * deletion stays user-triggered. No dormancy reaper: auto-deleting an idle account would destroy
 * club rosters, attendance history and reviews written about *other* people. See §6.1 of
 * `PLAN.md`.
 */
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

function cutoff(ageMs: number): string {
	return new Date(Date.now() - ageMs).toISOString();
}

/** Keyed on `expiresAt`, not `createdAt` — a still-valid long-lived session is still doing its job. */
export async function purgeExpiredSessions(): Promise<{ deleted: number; cutoffDate: string }> {
	const cutoffDate = cutoff(RETENTION.EXPIRED_SESSION);

	const deleted = await db.delete(session).where(lt(session.expiresAt, cutoffDate)).returning({ id: session.id });

	return { deleted: deleted.length, cutoffDate };
}

export async function purgeExpiredVerifications(): Promise<{ deleted: number; cutoffDate: string }> {
	const cutoffDate = cutoff(RETENTION.EXPIRED_VERIFICATION);

	const deleted = await db
		.delete(verification)
		.where(lt(verification.expiresAt, cutoffDate))
		.returning({ id: verification.id });

	return { deleted: deleted.length, cutoffDate };
}

/** Nulls the identifiers, leaving the audit entry itself in place. */
export async function stripAgedAuditLogIdentifiers(): Promise<{ updated: number; cutoffDate: string }> {
	const cutoffDate = cutoff(RETENTION.AUDIT_LOG_NETWORK_IDENTIFIERS);

	const updated = await db
		.update(clubAuditLog)
		.set({ ipAddress: null, userAgent: null })
		.where(
			and(
				lt(clubAuditLog.createdAt, cutoffDate),
				// Makes the task converge — without it every aged row is rewritten on every run.
				or(isNotNull(clubAuditLog.ipAddress), isNotNull(clubAuditLog.userAgent)),
			),
		)
		.returning({ id: clubAuditLog.id });

	return { updated: updated.length, cutoffDate };
}

/** Periods in the shape the privacy policy and ROPA need, so those can be checked against code. */
export function describeRetention(): Array<{ data: string; period: string }> {
	const inDays = (ms: number) => `${Math.round(ms / DAY)} days`;

	return [
		{ data: "Account and profile data", period: "For as long as the account exists" },
		{ data: "Expired sessions (including IP address and user agent)", period: inDays(RETENTION.EXPIRED_SESSION) },
		{ data: "Expired verification tokens", period: inDays(RETENTION.EXPIRED_VERIFICATION) },
		{
			data: "IP address and user agent on club audit entries",
			period: inDays(RETENTION.AUDIT_LOG_NETWORK_IDENTIFIERS),
		},
	];
}
