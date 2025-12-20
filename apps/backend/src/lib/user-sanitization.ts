import type { AnyColumn } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * User data sanitizer that handles privacy settings for database queries.
 * Create once with the request context, then reuse for multiple fields.
 */
export class Sanitize {
	private requestingUserId?: string | AnyColumn;
	private targetUserId?: string | AnyColumn;
	private isAdmin?: boolean;

	constructor(params: {
		requestingUserId?: string | AnyColumn;
		targetUserId?: string | AnyColumn;
		isAdmin?: boolean;
	}) {
		this.requestingUserId = params.requestingUserId;
		this.targetUserId = params.targetUserId;
		this.isAdmin = params.isAdmin;
	}

	/**
	 * Sanitizes any field based on its corresponding privacy field
	 * @param field - The database field to conditionally return
	 * @param privacyField - The boolean field that controls privacy
	 * @returns SQL expression that returns field value or NULL based on privacy rules
	 */
	field<T extends string | null = string | null>(field: AnyColumn, privacyField: AnyColumn) {
		// Always return a SQL expression for consistency
		if (this.isAdmin) {
			// Admin sees everything - just return the field value
			return sql<T>`${field}`.as(field.name || "field");
		}

		// If requesting user is the same as target user, return the field
		if (this.requestingUserId && this.targetUserId && this.requestingUserId === this.targetUserId) {
			return sql<T>`${field}`.as(field.name || "field");
		}

		// For list queries where we compare columns, use SQL CASE
		if (
			this.requestingUserId &&
			typeof this.requestingUserId !== "string" &&
			this.targetUserId &&
			typeof this.targetUserId !== "string"
		) {
			return sql<T>`CASE WHEN ${this.requestingUserId} = ${this.targetUserId} OR ${privacyField} = false THEN ${field} ELSE NULL END`.as(
				field.name || "field",
			);
		}

		// Fallback: check privacy flag
		return sql<T>`CASE WHEN ${privacyField} = false THEN ${field} ELSE NULL END`.as(field.name || "field");
	}
}
