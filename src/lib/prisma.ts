import "server-only";

// Import our new Prisma-like abstraction
import {
	$transaction,
	account,
	achievement,
	club,
	clubAuditLog,
	clubInvite,
	clubMembership,
	clubPurchase,
	clubRule,
	country,
	event,
	eventInvite,
	eventRegistration,
	instagramPageSelection,
	passkey,
	post,
	prisma,
	review,
	session,
	twofactor,
	user,
	verification,
} from "./prisma-models";

/**
 * This file now exports our custom Bun SQL database abstraction
 * that maintains the same API as Prisma but uses Bun's SQL engine
 * underneath for better performance.
 */

// Re-export everything from our new abstraction
export {
	prisma,
	user,
	club,
	event,
	eventRegistration,
	clubMembership,
	clubInvite,
	session,
	account,
	passkey,
	twofactor,
	review,
	post,
	achievement,
	clubAuditLog,
	country,
	clubRule,
	clubPurchase,
	eventInvite,
	instagramPageSelection,
	verification,
	$transaction,
};

// Export types that might be used
export type { JsonValue } from "./prisma-abstraction";
