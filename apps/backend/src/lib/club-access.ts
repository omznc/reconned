import { apiError } from "@reconned/router";
import { and, eq } from "drizzle-orm";
import { clubMembership } from "../drizzle/schema";
import { db } from "./db";

export type ClubMembershipRow = typeof clubMembership.$inferSelect;
export type ClubRole = ClubMembershipRow["role"];

/**
 * The single source of truth for "does this user currently belong to this club".
 * Archived memberships are deliberately excluded: the row survives for history,
 * but it grants neither membership nor permissions.
 */
export async function getActiveMembership(clubId: string, userId: string | undefined | null) {
	if (!userId) {
		return null;
	}

	const rows = await db
		.select()
		.from(clubMembership)
		.where(
			and(
				eq(clubMembership.clubId, clubId),
				eq(clubMembership.userId, userId),
				eq(clubMembership.status, "ACTIVE"),
			),
		)
		.limit(1);

	return rows[0] ?? null;
}

/** Includes archived rows. Only for flows that need the row itself, never for access checks. */
export async function getMembershipIncludingArchived(clubId: string, userId: string | undefined | null) {
	if (!userId) {
		return null;
	}

	const rows = await db
		.select()
		.from(clubMembership)
		.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, userId)))
		.limit(1);

	return rows[0] ?? null;
}

/** The field set that returns an archived membership to active. */
export const CLEAR_ARCHIVE: Pick<
	typeof clubMembership.$inferInsert,
	"status" | "archivedAt" | "archivedById" | "archiveReason" | "archiveNote"
> = {
	status: "ACTIVE",
	archivedAt: null,
	archivedById: null,
	archiveReason: null,
	archiveNote: null,
};

export function isClubManager(membership: { role: ClubRole } | null | undefined) {
	return membership?.role === "MANAGER" || membership?.role === "CLUB_OWNER";
}

export async function isClubManagerUser(clubId: string, userId: string | undefined | null) {
	return isClubManager(await getActiveMembership(clubId, userId));
}

export async function requireClubMember(clubId: string, userId: string | undefined | null) {
	const membership = await getActiveMembership(clubId, userId);

	if (!membership) {
		throw apiError.forbidden("Unauthorized - must be club member");
	}

	return membership;
}

export async function requireClubManager(clubId: string, userId: string | undefined | null) {
	const membership = await getActiveMembership(clubId, userId);

	if (!isClubManager(membership) || !membership) {
		throw apiError.forbidden("Unauthorized - must be manager or owner");
	}

	return membership;
}

export async function requireClubOwner(clubId: string, userId: string | undefined | null) {
	const membership = await getActiveMembership(clubId, userId);

	if (membership?.role !== "CLUB_OWNER") {
		throw apiError.forbidden("Unauthorized - must be club owner");
	}

	return membership;
}
