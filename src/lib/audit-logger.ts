import "server-only";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { headers } from "next/headers";
import { after } from "next/server";
import { captureException } from "@sentry/nextjs";
import type { JsonValue } from "@prisma/client/runtime/client";

type ClubActionType =
	| "CLUB_CREATE"
	| "CLUB_UPDATE"
	| "MEMBER_INVITE"
	| "MEMBER_REMOVE"
	| "MEMBER_PROMOTE"
	| "MEMBER_DEMOTE"
	| "MEMBER_JOIN"
	| "MEMBER_LEAVE"
	| "MEMBERSHIP_EXTENSION"
	| "CLUB_BAN"
	| "CLUB_UNBAN"
	| "SPENDING_CREATE"
	| "SPENDING_UPDATE"
	| "SPENDING_DELETE"
	| "POST_CREATE"
	| "POST_UPDATE"
	| "POST_DELETE"
	| "INSTAGRAM_CONNECT"
	| "INSTAGRAM_DISCONNECT"
	| "EVENT_CREATE"
	| "EVENT_UPDATE"
	| "EVENT_DELETE"
	| "CLUB_RULE_UPDATE"
	| "CLUB_RULE_CREATE"
	| "CLUB_RULE_DELETE";

interface AuditLogOptions {
	clubId: string;
	actionType: ClubActionType;
	actionData: JsonValue;
}

/**
 * Logs an audit event for club actions
 * This runs with `after` so you can call it whenever
 */
export async function logClubAudit({ clubId, actionType, actionData }: AuditLogOptions) {
	// You can't use `headers` in the `after()` callback, so we call it here.
	const headersList = await headers();

	after(async () => {
		try {
			const user = await isAuthenticated();
			if (!user) {
				captureException(new Error("User not authenticated"));
				return;
			}

			// Get IP and user agent from request headers
			const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
			const userAgent = headersList.get("user-agent") || "unknown";

			// Create audit log entry
			await prisma.clubAuditLog.create({
				data: {
					userId: user.id,
					clubId,
					actionType,
					actionData: actionData ?? {},
					ipAddress,
					userAgent,
				},
			});
		} catch (error) {
			captureException(error);
		}
	});
}
