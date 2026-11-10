import { and, inArray, isNotNull, lt, or } from "drizzle-orm";
import { clubAuditLog, session, verification } from "../drizzle/schema";
import { db } from "../lib/db";
import { RETENTION } from "../lib/retention-periods";

/**
 * Enforcement of the periods in `lib/retention-periods` — Art. 7(1)(e). The periods themselves
 * live there because the privacy policy has to state them and cannot import a database client;
 * this module only acts on them, and `scheduler.ts` only decides how often.
 */

// Re-exported so callers that enforce retention do not need both modules. The numbers are defined
// in `lib/retention-periods` — the privacy policy renders from that same object.
export { RETENTION };

function cutoff(ageMs: number): string {
	return new Date(Date.now() - ageMs).toISOString();
}

/**
 * These tasks first run against however much history already exists, which on `Session` is the
 * larger part of the table. Working in bounded batches keeps that first pass off a single
 * long-held lock, and keeps `returning()` from materialising every affected id at once — the count
 * is wanted for the log line, the rows themselves are not.
 */
const BATCH_SIZE = 5_000;

async function inBatches(runBatch: () => Promise<number>): Promise<number> {
	let total = 0;

	for (;;) {
		const affected = await runBatch();
		total += affected;

		if (affected < BATCH_SIZE) {
			return total;
		}
	}
}

/** Keyed on `expiresAt`, not `createdAt` — a still-valid long-lived session is still doing its job. */
export async function purgeExpiredSessions(): Promise<{ deleted: number; cutoffDate: string }> {
	const cutoffDate = cutoff(RETENTION.EXPIRED_SESSION);

	const deleted = await inBatches(async () => {
		const rows = await db
			.delete(session)
			.where(
				inArray(
					session.id,
					db
						.select({ id: session.id })
						.from(session)
						.where(lt(session.expiresAt, cutoffDate))
						.limit(BATCH_SIZE),
				),
			)
			.returning({ id: session.id });

		return rows.length;
	});

	return { deleted, cutoffDate };
}

export async function purgeExpiredVerifications(): Promise<{ deleted: number; cutoffDate: string }> {
	const cutoffDate = cutoff(RETENTION.EXPIRED_VERIFICATION);

	const deleted = await inBatches(async () => {
		const rows = await db
			.delete(verification)
			.where(
				inArray(
					verification.id,
					db
						.select({ id: verification.id })
						.from(verification)
						.where(lt(verification.expiresAt, cutoffDate))
						.limit(BATCH_SIZE),
				),
			)
			.returning({ id: verification.id });

		return rows.length;
	});

	return { deleted, cutoffDate };
}

/** Nulls the identifiers, leaving the audit entry itself in place. */
export async function stripAgedAuditLogIdentifiers(): Promise<{ updated: number; cutoffDate: string }> {
	const cutoffDate = cutoff(RETENTION.AUDIT_LOG_NETWORK_IDENTIFIERS);

	const aged = and(
		lt(clubAuditLog.createdAt, cutoffDate),
		// Makes the task converge — without it every aged row is rewritten on every run, and the
		// batch loop below would never see a short batch.
		or(isNotNull(clubAuditLog.ipAddress), isNotNull(clubAuditLog.userAgent)),
	);

	const updated = await inBatches(async () => {
		const rows = await db
			.update(clubAuditLog)
			.set({ ipAddress: null, userAgent: null })
			.where(
				inArray(
					clubAuditLog.id,
					db.select({ id: clubAuditLog.id }).from(clubAuditLog).where(aged).limit(BATCH_SIZE),
				),
			)
			.returning({ id: clubAuditLog.id });

		return rows.length;
	});

	return { updated, cutoffDate };
}
