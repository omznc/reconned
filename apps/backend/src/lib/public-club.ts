import { and, eq, or, type SQL, sql } from "drizzle-orm";
import { club, user } from "../drizzle/schema";
import { isFeatureEnabled } from "./feature-flags";

/** Clubs that are not banned and, when the flag is on, verified. Private clubs are not excluded. */
export async function clubListedCondition(): Promise<SQL | undefined> {
	const onlyVerified = await isFeatureEnabled("ONLY_VERIFIED_CLUBS_VISIBLE");
	return and(
		or(eq(club.banned, false), sql`${club.banned} IS NULL`),
		onlyVerified ? eq(club.verified, true) : undefined,
	);
}

/** Clubs any visitor may see: public, not banned and, when the flag is on, verified. */
export async function publicClubCondition(): Promise<SQL | undefined> {
	return and(eq(club.isPrivate, false), await clubListedCondition());
}

/** Hides banned users from everyone except an admin. */
export function userNotBanned(viewer: { isAdmin?: boolean }): SQL | undefined {
	return viewer.isAdmin ? undefined : or(eq(user.banned, false), sql`${user.banned} IS NULL`);
}
