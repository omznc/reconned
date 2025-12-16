import type { components, paths } from "@/lib/api-types";

/**
 * Shared API type helpers to replace @generated/client imports.
 *
 * These types are extracted from the backend API schema and should be used
 * instead of importing from @generated/client.
 */

// User types from better-auth schema
export type User = components["schemas"]["User"];
export type Session = components["schemas"]["Session"];
export type UserProfile = ApiResponse<"/api/users/{id}/profile", "get">;

// Club types
export type Club = ApiResponse<"/api/clubs/{id}", "get">;
export type ClubMember = ApiResponse<"/api/clubs/{id}/members", "get">["members"][number];
export type ClubMembershipResponse = ApiResponse<"/api/clubs/{id}/membership", "get">;
export type ClubMembership = NonNullable<ClubMembershipResponse["membership"]>;
export type ClubPurchase = ApiResponse<"/api/clubs/{id}/purchases/{purchaseId}", "get">["purchase"];

// Event types
export type Event = ApiResponse<"/api/events/{id}", "get">["event"];
export type EventRegistration = ApiResponse<"/api/events/{id}/registrations", "get">["registrations"][number];
export type EventInvite = ApiResponse<"/api/users/invites", "get">["invites"][number];

// Invite types
export type InviteStatus = ApiResponse<"/api/users/invites", "get">["invites"][number]["status"];

// Club content types
export type Post = ApiResponse<"/api/clubs/{id}/posts/{postId}", "get">["post"];
export type ClubRule = ApiResponse<"/api/clubs/{id}/rules/{ruleId}", "get">["rule"];

// Review types
export type Review = ApiResponse<"/api/reviews/{type}/{id}", "get">["reviews"][number] & {
	author: {
		id: string;
		name: string;
		image: string | null;
	};
};

// Enums and constants from Prisma
// Note: These should eventually be migrated to backend enums
export type Role = "USER" | "MANAGER" | "CLUB_OWNER";

// Role enum values for use in code (matching Prisma schema)
export const Role = {
	USER: "USER" as const,
	MANAGER: "MANAGER" as const,
	CLUB_OWNER: "CLUB_OWNER" as const,
};
/**
 * Helper type to extract the response data type from an API endpoint.
 *
 * @example
 * ```ts
 * type UserResponse = ApiResponse<"/api/users/{id}", "get">;
 * ```
 */
type ExtractJsonResponse<T> = T extends { responses: { 200: { content: { "application/json": infer U } } } }
	? U
	: never;

export type ApiResponse<Path extends keyof paths, Method extends keyof paths[Path]> = ExtractJsonResponse<
	paths[Path][Method]
>;
