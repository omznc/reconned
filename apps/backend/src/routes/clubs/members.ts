import { apiError, Router, responseSchema } from "@reconned/router";
import { randomUUIDv7 } from "bun";
import { and, count, desc, eq, ilike, ne, or } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { club, clubMembership, user } from "../../drizzle/schema";
import { logClubAudit } from "../../lib/audit-logger";
import { db } from "../../lib/db";
import { posthog } from "../../lib/posthog";
import { paginationQuerySchema, paginationResponseSchema } from "../../lib/schemas";
import { Sanitize } from "../../lib/user-sanitization";

const clubsMembersRouter = new Router();

const baseClubMembershipSchema = createSelectSchema(clubMembership);

const baseUserSchema = createSelectSchema(user);

const membershipWithUserSchema = baseClubMembershipSchema.extend({
	user: baseUserSchema.pick({
		id: true,
		name: true,
		email: true,
	}),
});

clubsMembersRouter.delete(
	"/clubs/:id/members/:memberId",
	async ({ params, response, context }) => {
		const clubId = params.id;
		const memberId = params.memberId;

		if (!clubId || !memberId) {
			throw apiError.validation("Club ID and Member ID are required");
		}

		const membershipData = await db
			.select({
				id: clubMembership.id,
				userId: clubMembership.userId,
				clubId: clubMembership.clubId,
				role: clubMembership.role,
				startDate: clubMembership.startDate,
				endDate: clubMembership.endDate,
				createdAt: clubMembership.createdAt,
				updatedAt: clubMembership.updatedAt,
			})
			.from(clubMembership)
			.where(
				and(
					eq(clubMembership.id, memberId),
					eq(clubMembership.clubId, clubId),
					ne(clubMembership.role, "CLUB_OWNER"),
				),
			)
			.limit(1);

		if (!membershipData[0]) {
			throw apiError.notFound("Member not found or is club owner");
		}

		const membership = membershipData[0];

		const userData = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
			})
			.from(user)
			.where(eq(user.id, membership.userId))
			.limit(1);

		if (!userData[0]) {
			throw apiError.notFound("User not found");
		}

		const membershipWithUser = {
			...membership,
			user: userData[0],
		};

		const managerMembershipData = await db
			.select({ role: clubMembership.role })
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		await db.delete(clubMembership).where(eq(clubMembership.id, memberId));

		await logClubAudit({
			clubId,
			actionType: "MEMBER_REMOVE",
			actionData: {
				memberId,
				memberName: membershipWithUser.user.name,
				memberRole: membershipWithUser.role,
				userId: membershipWithUser.user.id,
				removedBy: "manager",
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Remove member from club",
			description: "Remove a member from a club (cannot remove club owner)",
			params: z.object({
				id: z.string(),
				memberId: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
			mcpTool: true,
		},
	},
);

clubsMembersRouter.post(
	"/clubs/:id/members",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select({ role: clubMembership.role })
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		if (!body.userId) {
			throw apiError.validation("User ID is required");
		}

		const existingMembership = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, body.userId)))
			.limit(1);

		if (existingMembership[0]) {
			throw apiError.validation("User is already a member of this club");
		}

		const userData = await db
			.select({ id: user.id, name: user.name, email: user.email })
			.from(user)
			.where(eq(user.id, body.userId))
			.limit(1);

		if (!userData[0]) {
			throw apiError.notFound("User not found");
		}

		const newMembership = await db
			.insert(clubMembership)
			.values({
				id: randomUUIDv7(),
				clubId,
				userId: body.userId,
				role: body.role || "USER",
				startDate: new Date().toISOString(),
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.returning();

		await logClubAudit({
			clubId,
			actionType: "MEMBER_ADD",
			actionData: {
				userId: body.userId,
				userEmail: userData[0].email,
				userName: userData[0].name,
				role: body.role || "USER",
			},
			userId: context.user.id,
		});

		if (!newMembership[0]) {
			throw apiError.internal("Failed to create membership");
		}

		return response.json({ success: true, membership: newMembership[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Add member to club",
			description: "Add a user as a member to a club",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				userId: z.string(),
				role: z.enum(["USER", "MANAGER"]).optional(),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
					membership: baseClubMembershipSchema,
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
			mcpTool: true,
		},
	},
);

clubsMembersRouter.put(
	"/clubs/:id/members/:memberId/extend",
	async ({ params, response, context, body }) => {
		const clubId = params.id;
		const memberId = params.memberId;

		if (!clubId || !memberId) {
			throw apiError.validation("Club ID and Member ID are required");
		}

		if (!body.duration) {
			throw apiError.validation("Duration is required");
		}

		const managerMembershipData = await db
			.select({ role: clubMembership.role })
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const membershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.id, memberId), eq(clubMembership.clubId, clubId)))
			.limit(1);

		if (!membershipData[0]) {
			throw apiError.notFound("Membership not found");
		}

		const membership = membershipData[0];

		const userData = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
			})
			.from(user)
			.where(eq(user.id, membership.userId))
			.limit(1);

		if (!userData[0]) {
			throw apiError.notFound("User not found");
		}

		const membershipWithUser = {
			...membership,
			user: userData[0],
		};

		const today = new Date();
		let baseDate = membershipWithUser.endDate
			? new Date(membershipWithUser.endDate)
			: membershipWithUser.startDate
				? new Date(membershipWithUser.startDate)
				: today;
		if (!baseDate || baseDate < today) {
			baseDate = today;
		}

		const durationMonths = Number.parseInt(body.duration, 10);
		if (Number.isNaN(durationMonths) || durationMonths <= 0) {
			throw apiError.validation("Invalid duration");
		}

		const newEndDate = new Date(baseDate);
		newEndDate.setMonth(newEndDate.getMonth() + durationMonths);

		await db
			.update(clubMembership)
			.set({
				endDate: newEndDate.toISOString(),
				startDate: membershipWithUser.startDate || today.toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.where(eq(clubMembership.id, memberId));

		await logClubAudit({
			clubId,
			actionType: "MEMBERSHIP_EXTENSION",
			actionData: {
				memberId,
				memberName: membershipWithUser.user.name,
				memberRole: membershipWithUser.role,
				userId: membershipWithUser.user.id,
				duration: durationMonths,
				newEndDate: newEndDate.toISOString(),
			},
			userId: context.user.id,
		});

		// Track membership extension
		posthog.capture({
			distinctId: context.user.id,
			event: "club_membership_extended",
			properties: {
				club_id: clubId,
				member_id: membershipWithUser.user.id,
				member_name: membershipWithUser.user.name,
				extended_months: durationMonths,
				previous_end_date: membershipWithUser.endDate,
				new_end_date: newEndDate.toISOString(),
			},
		});

		return response.json({
			success: true,
			membership: {
				...membershipWithUser,
				endDate: newEndDate.toISOString(),
				startDate: membershipWithUser.startDate || today.toISOString(),
			},
			message: `Membership extended by ${durationMonths} months`,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Extend membership duration",
			description: "Extend a member's membership duration by a specified number of months",
			params: z.object({
				id: z.string(),
				memberId: z.string(),
			}),
			body: z.object({
				duration: z.string(),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
					membership: membershipWithUserSchema,
					message: z.string(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
			mcpTool: true,
		},
	},
);

clubsMembersRouter.post(
	"/clubs/:id/members/leave",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const membershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const membership = membershipData[0];

		if (!membership) {
			throw apiError.notFound("You are not a member of this club");
		}

		if (membership.role === "CLUB_OWNER") {
			throw apiError.validation(
				"Club owner cannot leave the club. You must transfer ownership or delete the club.",
			);
		}

		await logClubAudit({
			clubId,
			actionType: "MEMBER_LEAVE",
			actionData: {
				memberId: membership.id,
				memberRole: membership.role,
				userId: context.user.id,
			},
			userId: context.user.id,
		});

		await db.delete(clubMembership).where(eq(clubMembership.id, membership.id));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Leave club",
			description: "Leave a club (cannot leave if you are the club owner)",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
			mcpTool: true,
		},
	},
);

clubsMembersRouter.put(
	"/clubs/:id/members/:memberId",
	async ({ params, response, context, body }) => {
		const clubId = params.id;
		const memberId = params.memberId;

		if (!clubId || !memberId) {
			throw apiError.validation("Club ID and Member ID are required");
		}

		const ownerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(
				and(
					eq(clubMembership.clubId, clubId),
					eq(clubMembership.userId, context.user.id),
					eq(clubMembership.role, "CLUB_OWNER"),
				),
			)
			.limit(1);

		if (!ownerMembershipData[0]) {
			throw apiError.forbidden("Unauthorized - must be club owner");
		}

		const targetMembershipData = await db
			.select({
				id: clubMembership.id,
				role: clubMembership.role,
				userId: clubMembership.userId,
				user: {
					id: user.id,
					name: user.name,
					email: user.email,
				},
			})
			.from(clubMembership)
			.leftJoin(user, eq(clubMembership.userId, user.id))
			.where(and(eq(clubMembership.id, memberId), eq(clubMembership.clubId, clubId)))
			.limit(1);

		if (!targetMembershipData[0]) {
			throw apiError.notFound("Member not found");
		}

		if (targetMembershipData[0].role === "CLUB_OWNER") {
			throw apiError.validation("Cannot change club owner role");
		}

		if (body.role === "CLUB_OWNER") {
			throw apiError.validation("Cannot promote to club owner via this endpoint");
		}

		const updatedMembership = await db
			.update(clubMembership)
			.set({
				role: body.role,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(clubMembership.id, memberId))
			.returning();

		if (!updatedMembership[0]) {
			throw apiError.validation("Failed to update membership");
		}

		await logClubAudit({
			clubId,
			actionType: body.role === "MANAGER" ? "MEMBER_PROMOTE" : "MEMBER_DEMOTE",
			actionData: {
				memberId,
				memberName: targetMembershipData[0].user?.name,
				memberEmail: targetMembershipData[0].user?.email,
				fromRole: targetMembershipData[0].role,
				toRole: body.role,
			},
			userId: context.user.id,
		});

		return response.json({ success: true, membership: updatedMembership[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Update member role",
			description: "Promote or demote a member (requires club owner role)",
			params: z.object({
				id: z.string(),
				memberId: z.string(),
			}),
			body: z.object({
				role: z.enum(["USER", "MANAGER", "CLUB_OWNER"]),
			}),
			mcpTool: true,
			response: {
				200: z.object({
					success: z.boolean(),
					membership: baseClubMembershipSchema,
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

clubsMembersRouter.get(
	"/clubs/:id/managers",
	async ({ params, response, context, query }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select({ role: clubMembership.role })
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;

		const search = query?.search;

		const whereConditions = [
			eq(clubMembership.clubId, clubId),
			or(eq(clubMembership.role, "MANAGER"), eq(clubMembership.role, "CLUB_OWNER")),
		];

		if (search) {
			whereConditions.push(ilike(user.name, `%${search}%`));
		}

		const managers = await db
			.select({
				id: clubMembership.id,
				clubId: clubMembership.clubId,
				userId: clubMembership.userId,
				role: clubMembership.role,
				startDate: clubMembership.startDate,
				endDate: clubMembership.endDate,
				createdAt: clubMembership.createdAt,
				updatedAt: clubMembership.updatedAt,
				user: {
					id: user.id,
					name: user.name,
					email: user.email,
				},
			})
			.from(clubMembership)
			.leftJoin(user, eq(clubMembership.userId, user.id))
			.where(and(...whereConditions))
			.orderBy(desc(clubMembership.createdAt))
			.limit(perPage)
			.offset(offset);

		const totalData = await db
			.select({ count: count() })
			.from(clubMembership)
			.leftJoin(user, eq(clubMembership.userId, user.id))
			.where(and(...whereConditions));

		const total = totalData[0]?.count || 0;

		return response.json({
			managers: managers
				.filter((m): m is typeof m & { user: NonNullable<typeof m.user> } => m.user !== null)
				.map((m) => ({
					id: m.id,
					userId: m.userId,
					clubId: m.clubId,
					role: m.role,
					startDate: m.startDate,
					endDate: m.endDate,
					createdAt: m.createdAt,
					updatedAt: m.updatedAt,
					user: m.user,
				})),
			pagination: {
				page,
				perPage,
				total,
				totalPages: Math.ceil(total / perPage),
			},
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club managers",
			description: "Get paginated list of club managers and owners",
			params: z.object({
				id: z.string(),
			}),
			query: paginationQuerySchema.extend({
				search: z.string().max(100).optional(),
			}),
			response: {
				200: z.object({
					managers: z.array(membershipWithUserSchema),
					pagination: paginationResponseSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsMembersRouter.get(
	"/clubs/:id/members/count",
	async ({ params, response, query, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const membershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		if (!membershipData[0]) {
			throw apiError.forbidden("Unauthorized - must be club member");
		}

		const role = query?.role;
		const whereConditions = [eq(clubMembership.clubId, clubId)];

		if (role && ["USER", "MANAGER", "CLUB_OWNER"].includes(role)) {
			whereConditions.push(eq(clubMembership.role, role as "USER" | "MANAGER" | "CLUB_OWNER"));
		}

		const totalData = await db
			.select({ count: count() })
			.from(clubMembership)
			.where(and(...whereConditions));

		return response.json({ count: totalData[0]?.count || 0 });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Count club members",
			description: "Get count of members for a club with optional role filter",
			params: z.object({
				id: z.string(),
			}),
			query: z.object({
				role: z.string().optional(),
			}),
			response: {
				200: z.object({
					count: z.number(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsMembersRouter.get(
	"/clubs/:id/membership",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		if (!context.user) {
			return response.json({ isMember: false, membership: null });
		}

		const membershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		return response.json({
			isMember: !!membershipData[0],
			membership: membershipData[0] || null,
		});
	},
	{
		auth: false,
		cache: {
			key: "club:{id}:membership:{userId}",
			ttl: 120,
			varyByUser: true,
		},
		schema: {
			tags: ["Clubs"],
			summary: "Check club membership",
			description: "Check if current user is a member of the club",
			params: z.object({
				id: z.string(),
			}),
			query: z.object({
				limit: z.coerce.number().optional(),
			}),
			mcpTool: true,
			response: {
				200: z.object({
					isMember: z.boolean(),
					membership: baseClubMembershipSchema.nullable(),
				}),
				400: z.object({ error: z.string() }),
			},
		},
	},
);

clubsMembersRouter.get(
	"/clubs/:id/members",
	async ({ params, query, context, response }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		// Check if club exists and get its privacy setting
		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		// Check if user has access to view members
		// For public clubs, anyone can view members
		// For private clubs, only members can view
		let membershipData: Array<typeof clubMembership.$inferSelect> = [];
		if (clubData[0].isPrivate) {
			if (!context.user) {
				throw apiError.forbidden("You must be a member to view private club members");
			}

			membershipData = await db
				.select()
				.from(clubMembership)
				.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
				.limit(1);

			if (!membershipData[0]) {
				throw apiError.forbidden("You must be a member to view private club members");
			}
		}

		const { page, perPage, search, role, sortBy, sortOrder } = query;
		const offset = (page - 1) * perPage;

		// Build where conditions
		const whereConditions = [eq(clubMembership.clubId, clubId)];

		if (role && role !== "all") {
			whereConditions.push(eq(clubMembership.role, role as "USER" | "MANAGER" | "CLUB_OWNER"));
		}

		// Build the query with all conditions upfront
		const searchConditions = search
			? or(ilike(user.name, `%${search}%`), ilike(user.email, `%${search}%`), ilike(user.callsign, `%${search}%`))
			: undefined;

		// Get count of private members
		const privateCountResult = await db
			.select({ count: count() })
			.from(clubMembership)
			.innerJoin(user, eq(clubMembership.userId, user.id))
			.where(and(...whereConditions, eq(user.isPrivate, true)));
		const privateCount = Number(privateCountResult[0]?.count || 0);

		const sanitize = new Sanitize({
			requestingUserId: context.user?.id,
			targetUserId: user.id,
			isAdmin: context.isAdmin,
		});

		// Filter out private users
		const nonPrivateConditions = and(...whereConditions, eq(user.isPrivate, false));
		const allConditionsWithSearch = searchConditions
			? and(nonPrivateConditions, searchConditions)
			: nonPrivateConditions;

		const membersQuery = db
			.select({
				id: clubMembership.id,
				userId: clubMembership.userId,
				clubId: clubMembership.clubId,
				role: clubMembership.role,
				startDate: clubMembership.startDate,
				endDate: clubMembership.endDate,
				createdAt: clubMembership.createdAt,
				updatedAt: clubMembership.updatedAt,
				userName: user.name,
				userEmail: sanitize.field<string | null>(user.email, user.isPrivateEmail),
				userPhone: sanitize.field<string | null>(user.phone, user.isPrivatePhone),
				userImage: user.image,
				userCallsign: user.callsign,
				userLocation: user.location,
				userBio: user.bio,
				userWebsite: user.website,
				userCreatedAt: user.createdAt,
				userSlug: user.slug,
				userUserId: user.id,
			})
			.from(clubMembership)
			.innerJoin(user, eq(clubMembership.userId, user.id))
			.where(allConditionsWithSearch);

		// Apply sorting - determine sort field
		let sortField:
			| typeof user.name
			| typeof user.callsign
			| typeof clubMembership.role
			| typeof clubMembership.createdAt
			| ReturnType<typeof desc>
			| undefined;
		if (sortBy === "userName") {
			sortField = sortOrder === "desc" ? desc(user.name) : user.name;
		} else if (sortBy === "userCallsign") {
			sortField = sortOrder === "desc" ? desc(user.callsign) : user.callsign;
		} else if (sortBy === "role") {
			sortField = sortOrder === "desc" ? desc(clubMembership.role) : clubMembership.role;
		} else if (sortBy === "createdAt") {
			sortField = sortOrder === "desc" ? desc(clubMembership.createdAt) : clubMembership.createdAt;
		} else {
			sortField = desc(clubMembership.createdAt);
		}

		// Apply pagination
		const members = await membersQuery.orderBy(sortField).limit(perPage).offset(offset);

		// Get total count using the same conditions
		const totalResult = await db
			.select({ count: count() })
			.from(clubMembership)
			.innerJoin(user, eq(clubMembership.userId, user.id))
			.where(allConditionsWithSearch);
		const total = Number(totalResult[0]?.count || 0);

		// Format members to match frontend expectations
		const formattedMembers = members.map((member) => ({
			id: member.id,
			userId: member.userId,
			clubId: member.clubId,
			role: member.role,
			startDate: member.startDate,
			endDate: member.endDate,
			createdAt: member.createdAt,
			updatedAt: member.updatedAt,
			userName: member.userName,
			userCallsign: member.userCallsign,
			userAvatar: member.userImage,
			userSlug: member.userSlug,
			user: {
				id: member.userUserId,
				name: member.userName,
				email: member.userEmail,
				phone: member.userPhone,
				image: member.userImage,
				callsign: member.userCallsign,
				location: member.userLocation,
				bio: member.userBio,
				website: member.userWebsite,
				createdAt: member.userCreatedAt,
				slug: member.userSlug,
			},
		}));

		return response.json({
			members: formattedMembers,
			total,
			page,
			perPage,
			totalPages: Math.ceil(total / perPage),
			privateCount,
		});
	},
	{
		auth: false,
		cache: {
			key: "club:{id}:members",
			ttl: 300,
			swr: 1800,
			varyByQuery: ["page", "perPage", "search", "role", "sortBy", "sortOrder"],
			// NOT public-safe despite auth: false - member contact details are redacted per
			// requesting user via Sanitize, and private clubs are membership-gated.
			varyByUser: true,
		},
		schema: {
			tags: ["Clubs"],
			summary: "Get club members",
			description: "Get paginated list of club members with search and filtering",
			params: z.object({
				id: z.string(),
			}),
			query: paginationQuerySchema.extend({
				search: z.string().max(100).optional(),
				role: z.enum(["all", "USER", "MANAGER", "CLUB_OWNER"]).optional(),
				sortBy: z.enum(["userName", "userCallsign", "role", "createdAt"]).optional(),
				sortOrder: z.enum(["asc", "desc"]).optional(),
			}),
			response: {
				200: paginationResponseSchema.extend({
					members: z.array(
						baseClubMembershipSchema.extend({
							userName: z.string(),
							userCallsign: z.string().nullable(),
							userAvatar: z.string().nullable(),
							userSlug: z.string().nullable(),
							user: z.object({
								id: z.string(),
								name: z.string(),
								email: z.string().nullable(),
								phone: z.string().nullable(),
								image: z.string().nullable(),
								callsign: z.string().nullable(),
								location: z.string().nullable(),
								bio: z.string().nullable(),
								website: z.string().nullable(),
								createdAt: z.string(),
								slug: z.string().nullable(),
							}),
						}),
					),
					privateCount: z.number(),
				}),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
			mcpTool: true,
		},
	},
);

export { clubsMembersRouter };
