import { randomUUIDv7 } from "bun";
import { clubAuditLog } from "../drizzle/schema";
import { db } from "./db";

export async function logClubAudit(params: {
	clubId: string;
	actionType: string;
	actionData: Record<string, unknown>;
	userId?: string;
	ipAddress?: string;
	userAgent?: string;
}) {
	await db.insert(clubAuditLog).values({
		id: randomUUIDv7(),
		clubId: params.clubId,
		actionType: params.actionType,
		actionData: params.actionData as Record<string, unknown>,
		userId: params.userId || null,
		ipAddress: params.ipAddress || null,
		userAgent: params.userAgent || null,
		createdAt: new Date().toISOString(),
	});
}
