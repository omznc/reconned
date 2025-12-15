import { render } from "@react-email/components";
import { randomUUIDv7 } from "bun";
import { and, count, desc, eq, gt, ilike, ne, or, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
	club,
	clubAuditLog,
	clubInvite,
	clubMembership,
	clubPurchase,
	clubRule,
	event,
	eventRegistration,
	post,
	user,
} from "../drizzle/schema";
import ClubInvitationEmail from "../emails/airsoft-invitation";
import { logClubAudit } from "../lib/audit-logger";
import { db } from "../lib/db";
import { env } from "../lib/env";
import { apiError } from "../lib/errors";
import { sendEmail } from "../lib/mail";
import { Router, responseSchema } from "../lib/router";
import { paginationQuerySchema, paginationResponseSchema } from "../lib/schemas";
import { deleteS3Files, extractSizeFromKey, getS3UploadUrl } from "../lib/storage";

const clubsRouter = new Router();

const baseClubMembershipSchema = createSelectSchema(clubMembership);
const baseUserSchema = createSelectSchema(user);
const baseClubRuleSchema = createSelectSchema(clubRule);
const basePostSchema = createSelectSchema(post);
const baseClubPurchaseSchema = createSelectSchema(clubPurchase);
const baseClubInviteSchema = createSelectSchema(clubInvite);
const baseClubSchema = createSelectSchema(club);
const baseEventSchema = createSelectSchema(event);

const createRuleBodySchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().optional(),
	content: z.string(),
});

const createPostBodySchema = z.object({
	title: z.string().min(1).max(200),
	content: z.string(),
	images: z.array(z.string().url()).optional(),
	isPublic: z.boolean(),
});

const createPurchaseBodySchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	amount: z.number().min(0.01),
	receiptUrls: z.array(z.string().url()).max(3).optional(),
});

const updatePurchaseBodySchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	amount: z.number().min(0.01).optional(),
	receiptUrls: z.array(z.string().url()).max(3).optional(),
});

const createInviteBodySchema = z.object({
	userEmail: z.string().email(),
	userName: z.string().optional(),
});

const createClubBodySchema = z.object({
	name: z.string().min(1).max(50),
	countryId: z.number(),
	location: z.string().min(1).max(50),
	latitude: z.number().optional(),
	longitude: z.number().optional(),
	description: z.string().max(5000).optional(),
	slug: z.string().optional(),
	dateFounded: z.string().optional(),
	isAllied: z.boolean().optional(),
	isPrivate: z.boolean().optional(),
	isPrivateStats: z.boolean().optional(),
	logo: z.string().optional(),
	headerImage: z.string().optional(),
	contactPhone: z.string().optional(),
	contactEmail: z.string().optional(),
	website: z.string().optional(),
	instagramUsername: z.string().optional(),
});

const updateClubBodySchema = z.object({
	name: z.string().min(1).max(50).optional(),
	countryId: z.number().optional(),
	location: z.string().min(1).max(50).optional(),
	latitude: z.number().optional(),
	longitude: z.number().optional(),
	description: z.string().max(5000).optional(),
	slug: z.string().optional(),
	dateFounded: z.string().optional(),
	isAllied: z.boolean().optional(),
	isPrivate: z.boolean().optional(),
	isPrivateStats: z.boolean().optional(),
	logo: z.string().nullable().optional(),
	headerImage: z.string().nullable().optional(),
	contactPhone: z.string().optional(),
	contactEmail: z.string().optional(),
	website: z.string().optional(),
	instagramUsername: z.string().optional(),
});

const clubLogoUploadBodySchema = z.object({
	file: z.object({
		type: z.string().regex(/^image\//),
		size: z.number().max(1024 * 1024 * 4),
	}),
});

const membershipWithUserSchema = baseClubMembershipSchema.extend({
	user: baseUserSchema.pick({
		id: true,
		name: true,
		email: true,
	}),
});

clubsRouter.delete(
	"/api/clubs/:id/members/:memberId",
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
			.select()
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
				memberEmail: membershipWithUser.user.email,
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
		},
	},
);

clubsRouter.post(
	"/api/clubs/:id/members",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
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

		const userData = await db.select().from(user).where(eq(user.id, body.userId)).limit(1);

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
				role: z.enum(["USER", "MANAGER", "CLUB_OWNER"]).optional(),
			}),
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

clubsRouter.put(
	"/api/clubs/:id/members/:memberId/extend",
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
			.select()
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
				memberEmail: membershipWithUser.user.email,
				memberRole: membershipWithUser.role,
				userId: membershipWithUser.user.id,
				duration: durationMonths,
				newEndDate: newEndDate.toISOString(),
			},
			userId: context.user.id,
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
		},
	},
);

clubsRouter.post(
	"/api/clubs/:id/members/leave",
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
		},
	},
);

clubsRouter.get(
	"/api/clubs",
	async ({ response, query }) => {
		const { page = 1, perPage = 25, search = "", sortBy = "createdAt", sortOrder = "desc" } = query;
		const offset = (page - 1) * perPage;

		const whereConditions = [];

		if (search) {
			whereConditions.push(or(ilike(club.name, `%${search}%`), ilike(club.location, `%${search}%`)));
		}

		const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		let orderByClause: typeof club.name | typeof club.location | typeof club.createdAt | ReturnType<typeof desc>;
		if (sortBy === "name") {
			orderByClause = sortOrder === "asc" ? club.name : desc(club.name);
		} else if (sortBy === "location") {
			orderByClause = sortOrder === "asc" ? club.location : desc(club.location);
		} else {
			orderByClause = sortOrder === "asc" ? club.createdAt : desc(club.createdAt);
		}

		const clubs = await db
			.select()
			.from(club)
			.where(whereClause)
			.orderBy(orderByClause)
			.limit(perPage)
			.offset(offset);

		const totalData = await db.select({ count: count() }).from(club).where(whereClause);
		const total = totalData[0]?.count || 0;

		return response.json({
			clubs,
			pagination: {
				page,
				perPage,
				total,
				totalPages: Math.ceil(total / perPage),
			},
		});
	},
	{
		schema: {
			tags: ["Clubs"],
			summary: "List clubs",
			description: "List clubs with pagination, search, and sorting",
			query: paginationQuerySchema.extend({
				search: z.string().optional(),
				sortBy: z.enum(["name", "location", "createdAt"]).optional(),
				sortOrder: z.enum(["asc", "desc"]).optional(),
			}),
			response: {
				200: z.object({
					clubs: z.array(baseClubSchema),
					pagination: paginationResponseSchema,
				}),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/rules",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const rules = await db.select().from(clubRule).where(eq(clubRule.clubId, clubId));

		return response.json({ rules });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club rules",
			description: "Get all rules for a club",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					rules: z.array(baseClubRuleSchema),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/rules/:ruleId",
	async ({ params, response, context }) => {
		const clubId = params.id;
		const ruleId = params.ruleId;

		if (!clubId || !ruleId) {
			throw apiError.validation("Club ID and Rule ID are required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const ruleData = await db
			.select()
			.from(clubRule)
			.where(and(eq(clubRule.id, ruleId), eq(clubRule.clubId, clubId)))
			.limit(1);

		if (!ruleData[0]) {
			throw apiError.notFound("Rule not found");
		}

		return response.json({ rule: ruleData[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club rule",
			description: "Get a specific rule for a club",
			params: z.object({
				id: z.string(),
				ruleId: z.string(),
			}),
			response: {
				200: z.object({
					rule: baseClubRuleSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.post(
	"/api/clubs/:id/rules",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const ruleId = crypto.randomUUID();

		const rule = await db
			.insert(clubRule)
			.values({
				id: ruleId,
				clubId,
				name: body.name,
				description: body.description || null,
				content: body.content,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.returning();

		if (!rule[0]) {
			throw apiError.validation("Failed to create rule");
		}

		await logClubAudit({
			clubId,
			actionType: "CLUB_RULE_CREATE",
			actionData: {
				ruleId: rule[0].id,
				ruleName: rule[0].name,
				ruleDescription: rule[0].description || null,
			},
			userId: context.user.id,
		});

		return response.json({ success: true, rule: rule[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Create club rule",
			description: "Create a new rule for a club",
			params: z.object({
				id: z.string(),
			}),
			body: createRuleBodySchema,
			response: {
				200: z.object({
					success: z.boolean(),
					rule: baseClubRuleSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.put(
	"/api/clubs/:id/rules/:ruleId",
	async ({ params, response, context, body }) => {
		const clubId = params.id;
		const ruleId = params.ruleId;

		if (!clubId || !ruleId) {
			throw apiError.validation("Club ID and Rule ID are required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const ruleData = await db
			.select()
			.from(clubRule)
			.where(and(eq(clubRule.id, ruleId), eq(clubRule.clubId, clubId)))
			.limit(1);

		if (!ruleData[0]) {
			throw apiError.notFound("Rule not found");
		}

		const updatedRule = await db
			.update(clubRule)
			.set({
				name: body.name,
				description: body.description || null,
				content: body.content,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(clubRule.id, ruleId))
			.returning();

		if (!updatedRule[0]) {
			throw apiError.validation("Failed to update rule");
		}

		await logClubAudit({
			clubId,
			actionType: "CLUB_RULE_UPDATE",
			actionData: {
				ruleId: updatedRule[0].id,
				ruleName: updatedRule[0].name,
				ruleDescription: updatedRule[0].description || null,
			},
			userId: context.user.id,
		});

		return response.json({ success: true, rule: updatedRule[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Update club rule",
			description: "Update an existing rule for a club",
			params: z.object({
				id: z.string(),
				ruleId: z.string(),
			}),
			body: createRuleBodySchema,
			response: {
				200: z.object({
					success: z.boolean(),
					rule: baseClubRuleSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.delete(
	"/api/clubs/:id/rules/:ruleId",
	async ({ params, response, context }) => {
		const clubId = params.id;
		const ruleId = params.ruleId;

		if (!clubId || !ruleId) {
			throw apiError.validation("Club ID and Rule ID are required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const ruleData = await db
			.select()
			.from(clubRule)
			.where(and(eq(clubRule.id, ruleId), eq(clubRule.clubId, clubId)))
			.limit(1);

		if (!ruleData[0]) {
			throw apiError.notFound("Rule not found");
		}

		await db.delete(clubRule).where(eq(clubRule.id, ruleId));

		await logClubAudit({
			clubId,
			actionType: "CLUB_RULE_DELETE",
			actionData: {
				ruleId,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Delete club rule",
			description: "Delete a rule from a club",
			params: z.object({
				id: z.string(),
				ruleId: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/posts",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const posts = await db.select().from(post).where(eq(post.clubId, clubId)).orderBy(desc(post.createdAt));

		return response.json({ posts });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club posts",
			description: "Get all posts for a club",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					posts: z.array(basePostSchema),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/posts/:postId",
	async ({ params, response, context }) => {
		const clubId = params.id;
		const postId = params.postId;

		if (!clubId || !postId) {
			throw apiError.validation("Club ID and Post ID are required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const postData = await db
			.select()
			.from(post)
			.where(and(eq(post.id, postId), eq(post.clubId, clubId)))
			.limit(1);

		if (!postData[0]) {
			throw apiError.notFound("Post not found");
		}

		return response.json({ post: postData[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club post",
			description: "Get a specific post for a club",
			params: z.object({
				id: z.string(),
				postId: z.string(),
			}),
			response: {
				200: z.object({
					post: basePostSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/posts",
	async ({ params, response, context, query }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;

		const posts = await db
			.select()
			.from(post)
			.where(eq(post.clubId, clubId))
			.orderBy(desc(post.createdAt))
			.limit(perPage)
			.offset(offset);

		const totalData = await db.select({ count: count() }).from(post).where(eq(post.clubId, clubId));
		const total = totalData[0]?.count || 0;

		return response.json({
			posts,
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
			summary: "Get club posts",
			description: "Get all posts for a club with pagination",
			params: z.object({
				id: z.string(),
			}),
			query: paginationQuerySchema,
			response: {
				200: z.object({
					posts: z.array(basePostSchema),
					pagination: paginationResponseSchema,
				}),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/stats",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const clubData = await db.select({ createdAt: club.createdAt }).from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		const clubCreatedAt = clubData[0].createdAt;

		const membersOverTime = (await db.execute(sql`
			WITH RECURSIVE dates AS (
				SELECT DATE(date_trunc('day', ${clubCreatedAt}::timestamp))::timestamp as date
				UNION ALL
				SELECT (date + INTERVAL '1 day')::timestamp
				FROM dates
				WHERE date < DATE(NOW())
			)
			SELECT 
				d.date::date as date,
				COUNT(DISTINCT cm.id)::integer as count
			FROM dates d
			LEFT JOIN "ClubMembership" cm ON 
				DATE(cm."createdAt") <= d.date::date 
				AND cm."clubId" = ${clubId}
			GROUP BY d.date
			ORDER BY d.date ASC
		`)) as Array<{ date: Date | string; count: number | string }>;

		const roleDistribution = await db
			.select({
				role: clubMembership.role,
				count: count(),
			})
			.from(clubMembership)
			.where(eq(clubMembership.clubId, clubId))
			.groupBy(clubMembership.role);

		const eventsPerMonth = (await db.execute(sql`
			WITH RECURSIVE months AS (
				SELECT DATE_TRUNC('month', NOW() - INTERVAL '11 months')::date as month
				UNION ALL
				SELECT (month + INTERVAL '1 month')::date
				FROM months
				WHERE month < DATE_TRUNC('month', NOW())
			)
			SELECT 
				m.month,
				COUNT(e.id)::integer as count
			FROM months m
			LEFT JOIN "Event" e ON 
				DATE_TRUNC('month', e."dateStart") = m.month 
				AND e."clubId" = ${clubId}
			GROUP BY m.month
			ORDER BY m.month ASC
		`)) as Array<{ month: Date | string; count: number | string }>;

		const recentEventsData = await db
			.select({
				id: event.id,
				name: event.name,
				dateStart: event.dateStart,
			})
			.from(event)
			.where(eq(event.clubId, clubId))
			.orderBy(desc(event.dateStart))
			.limit(10);

		const recentEvents = await Promise.all(
			recentEventsData.map(async (e) => {
				const registrationCount = await db
					.select({ count: count() })
					.from(eventRegistration)
					.where(eq(eventRegistration.eventId, e.id));
				return {
					id: e.id,
					name: e.name,
					dateStart: e.dateStart,
					registrations: Number(registrationCount[0]?.count || 0),
				};
			}),
		);

		return response.json({
			members: membersOverTime.map((row) => ({
				date: row.date instanceof Date ? row.date.toISOString() : String(row.date),
				count: Number(row.count),
			})),
			roles: roleDistribution.map((r) => ({
				role: r.role,
				count: Number(r.count),
			})),
			events: eventsPerMonth.map((row) => ({
				month: row.month instanceof Date ? row.month.toISOString() : String(row.month),
				count: Number(row.count),
			})),
			recentEvents,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club statistics",
			description:
				"Get club statistics including members over time, role distribution, events per month, and recent events",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					members: z.array(
						z.object({
							date: z.string(),
							count: z.number(),
						}),
					),
					roles: z.array(
						z.object({
							role: z.string(),
							count: z.number(),
						}),
					),
					events: z.array(
						z.object({
							month: z.string(),
							count: z.number(),
						}),
					),
					recentEvents: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							dateStart: z.string(),
							registrations: z.number(),
						}),
					),
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/storage-quota",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const [postsUsage, receiptsUsage] = await Promise.all([
			db.select({ images: post.images }).from(post).where(eq(post.clubId, clubId)),
			db
				.select({ receiptUrls: clubPurchase.receiptUrls })
				.from(clubPurchase)
				.where(eq(clubPurchase.clubId, clubId)),
		]);

		const postImageSizes = postsUsage.flatMap((p) =>
			(p.images as string[]).map((imageKey) => extractSizeFromKey(imageKey)),
		);

		const receiptSizes = receiptsUsage.flatMap((purchase) =>
			(purchase.receiptUrls as string[]).map((receiptKey) => extractSizeFromKey(receiptKey)),
		);

		const CLUB_TOTAL_LIMIT = 1024 * 1024 * 1024;
		const currentUsage = [...postImageSizes, ...receiptSizes].reduce((total, size) => total + size, 0);
		const remaining = Math.max(0, CLUB_TOTAL_LIMIT - currentUsage);

		return response.json({
			currentUsage,
			limit: CLUB_TOTAL_LIMIT,
			remaining,
			allowed: currentUsage < CLUB_TOTAL_LIMIT,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club storage quota",
			description: "Check club storage quota usage from posts and purchases",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					currentUsage: z.number(),
					limit: z.number(),
					remaining: z.number(),
					allowed: z.boolean(),
				}),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

clubsRouter.post(
	"/api/clubs/:id/posts",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const postId = crypto.randomUUID();

		const newPost = await db
			.insert(post)
			.values({
				id: postId,
				clubId,
				title: body.title,
				content: body.content,
				images: body.images || [],
				isPublic: body.isPublic,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.returning();

		if (!newPost[0]) {
			throw apiError.validation("Failed to create post");
		}

		await logClubAudit({
			clubId,
			actionType: "POST_CREATE",
			actionData: {
				id: newPost[0].id,
				title: body.title,
				content: body.content,
				isPublic: body.isPublic,
				images: body.images || [],
			},
			userId: context.user.id,
		});

		return response.json({ success: true, post: newPost[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Create club post",
			description: "Create a new post for a club",
			params: z.object({
				id: z.string(),
			}),
			body: createPostBodySchema,
			response: {
				200: z.object({
					success: z.boolean(),
					post: basePostSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.put(
	"/api/clubs/:id/posts/:postId",
	async ({ params, response, context, body }) => {
		const clubId = params.id;
		const postId = params.postId;

		if (!clubId || !postId) {
			throw apiError.validation("Club ID and Post ID are required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const existingPostData = await db
			.select()
			.from(post)
			.where(and(eq(post.id, postId), eq(post.clubId, clubId)))
			.limit(1);

		if (!existingPostData[0]) {
			throw apiError.notFound("Post not found");
		}

		const existingPost = existingPostData[0];
		let imagesToDelete: string[] = [];

		if (existingPost.images && existingPost.images.length > 0) {
			const newImages = body.images || [];
			imagesToDelete = existingPost.images.filter((url) => !newImages.includes(url));
		}

		const updatedPost = await db
			.update(post)
			.set({
				title: body.title,
				content: body.content,
				images: body.images || [],
				isPublic: body.isPublic,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(post.id, postId))
			.returning();

		if (!updatedPost[0]) {
			throw apiError.validation("Failed to update post");
		}

		if (imagesToDelete.length > 0) {
			const imageKeys = imagesToDelete.map((url) => {
				const urlObj = new URL(url);
				return urlObj.pathname.substring(1);
			});
			await deleteS3Files(imageKeys);
		}

		await logClubAudit({
			clubId,
			actionType: "POST_UPDATE",
			actionData: {
				id: updatedPost[0].id,
				title: body.title,
				content: body.content,
				isPublic: body.isPublic,
				images: body.images || [],
			},
			userId: context.user.id,
		});

		return response.json({ success: true, post: updatedPost[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Update club post",
			description: "Update an existing post for a club",
			params: z.object({
				id: z.string(),
				postId: z.string(),
			}),
			body: createPostBodySchema,
			response: {
				200: z.object({
					success: z.boolean(),
					post: basePostSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.delete(
	"/api/clubs/:id/posts/:postId",
	async ({ params, response, context }) => {
		const clubId = params.id;
		const postId = params.postId;

		if (!clubId || !postId) {
			throw apiError.validation("Club ID and Post ID are required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const postData = await db
			.select()
			.from(post)
			.where(and(eq(post.id, postId), eq(post.clubId, clubId)))
			.limit(1);

		if (!postData[0]) {
			throw apiError.notFound("Post not found");
		}

		if (postData[0].images && postData[0].images.length > 0) {
			const imageKeys = postData[0].images.map((url) => {
				const urlObj = new URL(url);
				return urlObj.pathname.substring(1);
			});
			await deleteS3Files(imageKeys);
		}

		await db.delete(post).where(eq(post.id, postId));

		await logClubAudit({
			clubId,
			actionType: "POST_DELETE",
			actionData: {
				id: postId,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Delete club post",
			description: "Delete a post from a club",
			params: z.object({
				id: z.string(),
				postId: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.post(
	"/api/clubs/:id/posts/images/upload-url",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const secureFilename = `${Date.now()}_${body.file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
		const key = `post-images/${clubId}/${secureFilename}`;

		try {
			const result = await getS3UploadUrl(key, body.file.type, body.file.size);
			return response.json(result);
		} catch (error) {
			throw apiError.internal(error instanceof Error ? error.message : "Failed to generate upload URL");
		}
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get post image upload URL",
			description: "Get a presigned S3 URL for uploading a post image",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				file: z.object({
					name: z.string(),
					type: z.string(),
					size: z.number(),
				}),
			}),
			response: {
				200: z.object({
					url: z.string(),
					cdnUrl: z.string(),
					key: z.string(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/purchases",
	async ({ params, response, context, query }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;

		const purchases = await db
			.select()
			.from(clubPurchase)
			.where(eq(clubPurchase.clubId, clubId))
			.orderBy(desc(clubPurchase.createdAt))
			.limit(perPage)
			.offset(offset);

		const totalData = await db.select({ count: count() }).from(clubPurchase).where(eq(clubPurchase.clubId, clubId));

		const total = totalData[0]?.count || 0;

		return response.json({
			purchases,
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
			summary: "Get club purchases",
			description: "Get paginated purchases for a club",
			params: z.object({
				id: z.string(),
			}),
			query: paginationQuerySchema,
			response: {
				200: z.object({
					purchases: z.array(baseClubPurchaseSchema),
					pagination: paginationResponseSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/audit-logs",
	async ({ params, response, context, query }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;
		const actionType = query?.actionType || "";

		const whereConditions = [eq(clubAuditLog.clubId, clubId)];

		if (actionType) {
			whereConditions.push(eq(clubAuditLog.actionType, actionType));
		}

		const whereClause = and(...whereConditions);

		const logs = await db
			.select()
			.from(clubAuditLog)
			.where(whereClause)
			.orderBy(desc(clubAuditLog.createdAt))
			.limit(perPage)
			.offset(offset);

		const totalData = await db.select({ count: count() }).from(clubAuditLog).where(whereClause);
		const total = totalData[0]?.count || 0;

		return response.json({
			logs: logs.map((log) => ({
				...log,
				actionData: log.actionData as Record<string, unknown>,
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
			summary: "Get club audit logs",
			description: "Get audit logs for a club with pagination and filtering",
			params: z.object({
				id: z.string(),
			}),
			query: paginationQuerySchema.extend({
				actionType: z.string().optional(),
			}),
			response: {
				200: z.object({
					logs: z.array(
						z.object({
							id: z.string(),
							createdAt: z.string(),
							userId: z.string().nullable(),
							clubId: z.string(),
							actionType: z.string(),
							actionData: z.record(z.string(), z.unknown()),
							ipAddress: z.string().nullable(),
							userAgent: z.string().nullable(),
						}),
					),
					pagination: paginationResponseSchema,
				}),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/purchases/:purchaseId",
	async ({ params, response, context }) => {
		const clubId = params.id;
		const purchaseId = params.purchaseId;

		if (!clubId || !purchaseId) {
			throw apiError.validation("Club ID and Purchase ID are required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const purchaseData = await db
			.select()
			.from(clubPurchase)
			.where(and(eq(clubPurchase.id, purchaseId), eq(clubPurchase.clubId, clubId)))
			.limit(1);

		if (!purchaseData[0]) {
			throw apiError.notFound("Purchase not found");
		}

		return response.json({ purchase: purchaseData[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club purchase",
			description: "Get a specific purchase for a club",
			params: z.object({
				id: z.string(),
				purchaseId: z.string(),
			}),
			response: {
				200: z.object({
					purchase: baseClubPurchaseSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.post(
	"/api/clubs/:id/purchases",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		if (body.receiptUrls && body.receiptUrls.length > 3) {
			throw apiError.validation("Maximum 3 receipts per item");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const purchaseId = crypto.randomUUID();

		const newPurchase = await db
			.insert(clubPurchase)
			.values({
				id: purchaseId,
				clubId,
				title: body.title,
				description: body.description || null,
				amount: body.amount,
				receiptUrls: body.receiptUrls || [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.returning();

		if (!newPurchase[0]) {
			throw apiError.internal("Failed to create purchase");
		}

		await logClubAudit({
			clubId,
			actionType: "PURCHASE_CREATE",
			actionData: {
				title: body.title,
				description: body.description,
				amount: body.amount,
				receiptUrls: body.receiptUrls,
			},
			userId: context.user.id,
		});

		return response.json({ success: true, purchase: newPurchase[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Create club purchase",
			description: "Create a new purchase for a club",
			params: z.object({
				id: z.string(),
			}),
			body: createPurchaseBodySchema,
			response: {
				200: z.object({
					success: z.boolean(),
					purchase: baseClubPurchaseSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				500: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.put(
	"/api/clubs/:id/purchases/:purchaseId",
	async ({ params, response, context, body }) => {
		const clubId = params.id;
		const purchaseId = params.purchaseId;

		if (!clubId || !purchaseId) {
			throw apiError.validation("Club ID and Purchase ID are required");
		}

		if (body.receiptUrls && body.receiptUrls.length > 3) {
			throw apiError.validation("Maximum 3 receipts per item");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const purchaseData = await db
			.select()
			.from(clubPurchase)
			.where(and(eq(clubPurchase.id, purchaseId), eq(clubPurchase.clubId, clubId)))
			.limit(1);

		if (!purchaseData[0]) {
			throw apiError.notFound("Purchase not found");
		}

		const updatedPurchase = await db
			.update(clubPurchase)
			.set({
				title: body.title,
				description: body.description || null,
				amount: body.amount,
				receiptUrls: body.receiptUrls || [],
				updatedAt: new Date().toISOString(),
			})
			.where(eq(clubPurchase.id, purchaseId))
			.returning();

		if (!updatedPurchase[0]) {
			throw apiError.internal("Failed to update purchase");
		}

		await logClubAudit({
			clubId,
			actionType: "PURCHASE_UPDATE",
			actionData: {
				id: updatedPurchase[0].id,
				title: body.title,
				description: body.description,
				amount: body.amount,
				receiptUrls: body.receiptUrls,
			},
			userId: context.user.id,
		});

		return response.json({ success: true, purchase: updatedPurchase[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Update club purchase",
			description: "Update an existing purchase for a club",
			params: z.object({
				id: z.string(),
				purchaseId: z.string(),
			}),
			body: updatePurchaseBodySchema,
			response: {
				200: z.object({
					success: z.boolean(),
					purchase: baseClubPurchaseSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.delete(
	"/api/clubs/:id/purchases/:purchaseId",
	async ({ params, response, context }) => {
		const clubId = params.id;
		const purchaseId = params.purchaseId;

		if (!clubId || !purchaseId) {
			throw apiError.validation("Club ID and Purchase ID are required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const purchaseData = await db
			.select()
			.from(clubPurchase)
			.where(and(eq(clubPurchase.id, purchaseId), eq(clubPurchase.clubId, clubId)))
			.limit(1);

		if (!purchaseData[0]) {
			throw apiError.notFound("Purchase not found");
		}

		if (purchaseData[0].receiptUrls && purchaseData[0].receiptUrls.length > 0) {
			const receiptKeys = purchaseData[0].receiptUrls.map((url) => {
				const urlObj = new URL(url);
				return urlObj.pathname.substring(1);
			});
			await deleteS3Files(receiptKeys);
		}

		await db.delete(clubPurchase).where(eq(clubPurchase.id, purchaseId));

		await logClubAudit({
			clubId,
			actionType: "PURCHASE_DELETE",
			actionData: {
				id: purchaseId,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Delete club purchase",
			description: "Delete a purchase from a club",
			params: z.object({
				id: z.string(),
				purchaseId: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.post(
	"/api/clubs/:id/purchases/receipts/upload-url",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const secureFilename = `${Date.now()}_${body.file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
		const key = `receipt/${clubId}/${secureFilename}`;

		try {
			const result = await getS3UploadUrl(key, body.file.type, body.file.size);
			return response.json(result);
		} catch (error) {
			throw apiError.internal(error instanceof Error ? error.message : "Failed to generate upload URL");
		}
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get purchase receipt upload URL",
			description: "Get a presigned S3 URL for uploading a purchase receipt",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				file: z.object({
					name: z.string(),
					type: z.string(),
					size: z.number(),
				}),
			}),
			response: {
				200: z.object({
					url: z.string(),
					cdnUrl: z.string(),
					key: z.string(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/invites",
	async ({ params, response, context, query }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
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
		const status = query?.status;

		const whereConditions = [eq(clubInvite.clubId, clubId)];

		if (status && ["PENDING", "ACCEPTED", "REJECTED", "EXPIRED", "REVOKED", "REQUESTED"].includes(status)) {
			whereConditions.push(
				eq(
					clubInvite.status,
					status as "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "REVOKED" | "REQUESTED",
				),
			);
		}

		if (search) {
			whereConditions.push(ilike(clubInvite.email, `%${search}%`));
		}

		const invites = await db
			.select({
				id: clubInvite.id,
				email: clubInvite.email,
				clubId: clubInvite.clubId,
				userId: clubInvite.userId,
				status: clubInvite.status,
				inviteCode: clubInvite.inviteCode,
				expiresAt: clubInvite.expiresAt,
				createdAt: clubInvite.createdAt,
				updatedAt: clubInvite.updatedAt,
				user: {
					id: user.id,
					name: user.name,
				},
			})
			.from(clubInvite)
			.leftJoin(user, eq(clubInvite.userId, user.id))
			.where(and(...whereConditions))
			.orderBy(desc(clubInvite.createdAt))
			.limit(perPage)
			.offset(offset);

		const totalData = await db
			.select({ count: count() })
			.from(clubInvite)
			.where(and(...whereConditions));

		const total = totalData[0]?.count || 0;

		return response.json({
			invites: invites.map((invite) => ({
				...invite,
				userName: invite.user?.name || null,
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
			summary: "Get club invites",
			description: "Get paginated invites for a club with search and status filtering",
			params: z.object({
				id: z.string(),
			}),
			query: paginationQuerySchema.extend({
				search: z.string().optional(),
				status: z.string().optional(),
			}),
			response: {
				200: z.object({
					invites: z.array(
						baseClubInviteSchema.extend({
							userName: z.string().nullable(),
						}),
					),
					pagination: paginationResponseSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.post(
	"/api/clubs/:id/invites",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		const existingInvite = await db
			.select()
			.from(clubInvite)
			.where(
				and(
					eq(clubInvite.email, body.userEmail),
					eq(clubInvite.clubId, clubId),
					eq(clubInvite.status, "PENDING"),
					gt(clubInvite.expiresAt, new Date().toISOString()),
				),
			)
			.limit(1);

		if (existingInvite[0]) {
			throw apiError.validation("Invitation already sent to this email");
		}

		const existingUser = await db.select().from(user).where(eq(user.email, body.userEmail)).limit(1);

		if (existingUser[0]) {
			const existingMembership = await db
				.select()
				.from(clubMembership)
				.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, existingUser[0].id)))
				.limit(1);

			if (existingMembership[0]) {
				throw apiError.validation("User is already a member of this club");
			}
		}

		const inviteCode = Math.random().toString(36).substring(2, 16).toUpperCase();
		const inviteId = crypto.randomUUID();
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

		const newInvite = await db
			.insert(clubInvite)
			.values({
				id: inviteId,
				email: body.userEmail,
				clubId,
				status: "PENDING",
				inviteCode,
				expiresAt,
				userId: existingUser[0]?.id || null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.returning();

		if (!newInvite[0]) {
			throw apiError.internal("Failed to create invite");
		}

		await logClubAudit({
			clubId,
			actionType: "MEMBER_INVITE",
			actionData: {
				inviteId: newInvite[0].id,
				inviteCode: newInvite[0].inviteCode,
				email: newInvite[0].email,
				userName: body.userName,
				existingUserId: existingUser[0]?.id,
			},
			userId: context.user.id,
		});

		const inviteUrl = `${env.BETTER_AUTH_URL}/api/club/member-invite/${newInvite[0].inviteCode}?redirectTo=${encodeURIComponent("/")}`;

		try {
			await sendEmail({
				to: body.userEmail,
				subject: `Invitation to join ${clubData[0].name}`,
				html: await render(
					ClubInvitationEmail({
						code: newInvite[0].inviteCode,
						url: inviteUrl,
						name: body.userName,
						clubLogo: clubData[0].logo || `${env.BETTER_AUTH_URL}/logo.png`,
						clubName: clubData[0].name,
						clubLocation: clubData[0].location || "",
					}),
					{
						pretty: true,
					},
				),
			});
		} catch (error) {
			console.error("Failed to send invitation email:", error);
		}

		return response.json({ success: true, invite: newInvite[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Send club invitation",
			description: "Create and send a club invitation",
			params: z.object({
				id: z.string(),
			}),
			body: createInviteBodySchema,
			response: {
				200: z.object({
					success: z.boolean(),
					invite: baseClubInviteSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.put(
	"/api/clubs/:id/invites/:inviteId/revoke",
	async ({ params, response, context }) => {
		const clubId = params.id;
		const inviteId = params.inviteId;

		if (!clubId || !inviteId) {
			throw apiError.validation("Club ID and Invite ID are required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const inviteData = await db
			.select()
			.from(clubInvite)
			.where(and(eq(clubInvite.id, inviteId), eq(clubInvite.clubId, clubId), eq(clubInvite.status, "PENDING")))
			.limit(1);

		if (!inviteData[0]) {
			throw apiError.notFound("Invite not found or already used");
		}

		const updatedInvite = await db
			.update(clubInvite)
			.set({
				status: "REVOKED",
				updatedAt: new Date().toISOString(),
			})
			.where(eq(clubInvite.id, inviteId))
			.returning();

		if (!updatedInvite[0]) {
			throw apiError.validation("Failed to revoke invite");
		}

		await logClubAudit({
			clubId,
			actionType: "MEMBER_INVITE",
			actionData: {
				inviteId,
				action: "revoke",
				email: updatedInvite[0].email,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Revoke club invitation",
			description: "Revoke a pending club invitation",
			params: z.object({
				id: z.string(),
				inviteId: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/invites/count",
	async ({ params, response, query, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const status = query?.status;
		const whereConditions = [eq(clubInvite.clubId, clubId)];

		if (status && ["PENDING", "ACCEPTED", "REJECTED", "EXPIRED", "REVOKED", "REQUESTED"].includes(status)) {
			whereConditions.push(
				eq(
					clubInvite.status,
					status as "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "REVOKED" | "REQUESTED",
				),
			);
		}

		const totalData = await db
			.select({ count: count() })
			.from(clubInvite)
			.where(and(...whereConditions));

		return response.json({ count: totalData[0]?.count || 0 });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Count club invites",
			description: "Get count of invites for a club with optional status filter",
			params: z.object({
				id: z.string(),
			}),
			query: z.object({
				status: z.string().optional(),
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

clubsRouter.get(
	"/api/clubs/:id/invites/requests-count",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const requestsData = await db
			.select({ count: count() })
			.from(clubInvite)
			.where(and(eq(clubInvite.clubId, clubId), eq(clubInvite.status, "REQUESTED")));

		return response.json({ count: requestsData[0]?.count || 0 });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get invite requests count",
			description: "Get count of invite requests (status REQUESTED) for a club",
			params: z.object({
				id: z.string(),
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

async function validateSlug(slug: string, excludeClubId?: string): Promise<boolean> {
	const [clubBySlug, clubById] = await Promise.all([
		db.select().from(club).where(eq(club.slug, slug)).limit(1),
		db.select().from(club).where(eq(club.id, slug)).limit(1),
	]);

	if (excludeClubId) {
		return !(clubBySlug[0] && clubBySlug[0].id !== excludeClubId) && !clubById[0];
	}

	return !clubBySlug[0] && !clubById[0];
}

clubsRouter.get(
	"/api/clubs/:id",
	async ({ params, response }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const clubData = await db
			.select()
			.from(club)
			.where(or(eq(club.id, clubId), eq(club.slug, clubId)))
			.limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		const membersCount = await db
			.select({ count: count() })
			.from(clubMembership)
			.where(eq(clubMembership.clubId, clubData[0].id));

		const postsCount = await db.select({ count: count() }).from(post).where(eq(post.clubId, clubData[0].id));

		return response.json({
			...clubData[0],
			_count: {
				members: membersCount[0]?.count || 0,
				posts: postsCount[0]?.count || 0,
			},
		});
	},
	{
		auth: false,
		schema: {
			tags: ["Clubs"],
			summary: "Get club by ID or slug",
			description: "Get club information by ID or slug",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: baseClubSchema.extend({
					_count: z.object({
						members: z.number(),
						posts: z.number(),
					}),
				}),
				400: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/information",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		const membershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const membership = membershipData[0];

		if (!membership || (membership.role !== "MANAGER" && membership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		return response.json(clubData[0]);
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club information for editing",
			description: "Get club information for editing (requires manager or owner role)",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: baseClubSchema,
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.post(
	"/api/clubs",
	async ({ context, response, body }) => {
		if (body.slug) {
			const valid = await validateSlug(body.slug);
			if (!valid) {
				throw apiError.validation("Slug is already taken");
			}
		}

		const clubId = randomUUIDv7();
		const now = new Date().toISOString();

		const newClub = await db
			.insert(club)
			.values({
				id: clubId,
				name: body.name,
				countryId: body.countryId,
				location: body.location,
				latitude: body.latitude || null,
				longitude: body.longitude || null,
				description: body.description || null,
				slug: body.slug || null,
				dateFounded: body.dateFounded || null,
				isAllied: body.isAllied || false,
				isPrivate: body.isPrivate || false,
				isPrivateStats: body.isPrivateStats || false,
				logo: body.logo || null,
				headerImage: body.headerImage || null,
				contactPhone: body.contactPhone || null,
				contactEmail: body.contactEmail || null,
				website: body.website || null,
				instagramUsername: body.instagramUsername || null,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		if (!newClub[0]) {
			throw apiError.internal("Failed to create club");
		}

		await db.insert(clubMembership).values({
			id: randomUUIDv7(),
			clubId: newClub[0].id,
			userId: context.user.id,
			role: "CLUB_OWNER",
			startDate: now,
			endDate: null,
			createdAt: now,
			updatedAt: now,
		});

		await logClubAudit({
			clubId: newClub[0].id,
			actionType: "CLUB_CREATE",
			actionData: {
				name: body.name,
				location: body.location,
				slug: body.slug,
			},
			userId: context.user.id,
		});

		return response.json({ id: newClub[0].id, club: newClub[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Create club",
			description: "Create a new club and assign the creator as owner",
			body: createClubBodySchema,
			response: {
				200: z.object({
					id: z.string(),
					club: baseClubSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.put(
	"/api/clubs/:id",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		if (body.slug) {
			const valid = await validateSlug(body.slug, clubId);
			if (!valid) {
				throw apiError.validation("Slug is already taken");
			}
		}

		const updateData: Record<string, unknown> = {
			updatedAt: new Date().toISOString(),
		};

		if (body.name !== undefined) updateData.name = body.name;
		if (body.countryId !== undefined) updateData.countryId = body.countryId;
		if (body.location !== undefined) updateData.location = body.location;
		if (body.latitude !== undefined) updateData.latitude = body.latitude;
		if (body.longitude !== undefined) updateData.longitude = body.longitude;
		if (body.description !== undefined) updateData.description = body.description;
		if (body.slug !== undefined) updateData.slug = body.slug;
		if (body.dateFounded !== undefined) updateData.dateFounded = body.dateFounded;
		if (body.isAllied !== undefined) updateData.isAllied = body.isAllied;
		if (body.isPrivate !== undefined) updateData.isPrivate = body.isPrivate;
		if (body.isPrivateStats !== undefined) updateData.isPrivateStats = body.isPrivateStats;
		if (body.logo !== undefined) updateData.logo = body.logo;
		if (body.headerImage !== undefined) updateData.headerImage = body.headerImage;
		if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone;
		if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail;
		if (body.website !== undefined) updateData.website = body.website;
		if (body.instagramUsername !== undefined) updateData.instagramUsername = body.instagramUsername;

		const updatedClub = await db.update(club).set(updateData).where(eq(club.id, clubId)).returning();

		if (!updatedClub[0]) {
			throw apiError.notFound("Club not found");
		}

		await logClubAudit({
			clubId,
			actionType: "CLUB_UPDATE",
			actionData: {
				...body,
			},
			userId: context.user.id,
		});

		return response.json({ success: true, club: updatedClub[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Update club information",
			description: "Update club information (requires manager or owner role)",
			params: z.object({
				id: z.string(),
			}),
			body: updateClubBodySchema,
			response: {
				200: z.object({
					success: z.boolean(),
					club: baseClubSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.delete(
	"/api/clubs/:id",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
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

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		const filesToDelete: string[] = [];
		if (clubData[0].logo) {
			filesToDelete.push(`club/${clubId}/logo`);
		}
		if (clubData[0].headerImage) {
			filesToDelete.push(`club/${clubId}/header`);
		}

		if (filesToDelete.length > 0) {
			await deleteS3Files(filesToDelete);
		}

		await db.delete(club).where(eq(club.id, clubId));

		await logClubAudit({
			clubId,
			actionType: "CLUB_DELETE",
			actionData: {
				name: clubData[0].name,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Delete club",
			description: "Delete a club (requires club owner role)",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.post(
	"/api/clubs/:id/logo/upload-url",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const key = `club/${clubId}/logo`;
		const uploadUrl = await getS3UploadUrl(key, body.file.type, body.file.size);

		return response.json(uploadUrl);
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club logo upload URL",
			description: "Get presigned S3 URL for uploading club logo",
			params: z.object({
				id: z.string(),
			}),
			body: clubLogoUploadBodySchema,
			response: {
				200: z.object({
					url: z.string(),
					cdnUrl: z.string(),
					key: z.string(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.post(
	"/api/clubs/:id/header-image/upload-url",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const key = `club/${clubId}/header`;
		const uploadUrl = await getS3UploadUrl(key, body.file.type, body.file.size);

		return response.json(uploadUrl);
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club header image upload URL",
			description: "Get presigned S3 URL for uploading club header image",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				file: z.object({
					type: z.string().regex(/^image\//),
					size: z.number().max(1024 * 1024 * 8),
				}),
			}),
			response: {
				200: z.object({
					url: z.string(),
					cdnUrl: z.string(),
					key: z.string(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.delete(
	"/api/clubs/:id/logo",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		await db
			.update(club)
			.set({
				logo: null,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(club.id, clubId));

		await deleteS3Files([`club/${clubId}/logo`]);

		await logClubAudit({
			clubId,
			actionType: "CLUB_UPDATE",
			actionData: {
				logoRemoved: true,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Delete club logo",
			description: "Delete club logo (requires manager or owner role)",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.delete(
	"/api/clubs/:id/header-image",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		await db
			.update(club)
			.set({
				headerImage: null,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(club.id, clubId));

		await deleteS3Files([`club/${clubId}/header`]);

		await logClubAudit({
			clubId,
			actionType: "CLUB_UPDATE",
			actionData: {
				headerImageRemoved: true,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Delete club header image",
			description: "Delete club header image (requires manager or owner role)",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.put(
	"/api/clubs/:id/members/:memberId",
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

clubsRouter.get(
	"/api/clubs/:id/managers",
	async ({ params, response, context, query }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
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
				search: z.string().optional(),
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

clubsRouter.get(
	"/api/clubs/:id/members/count",
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

clubsRouter.get(
	"/api/clubs/managed",
	async ({ context, response }) => {
		const managedClubs = await db
			.select({
				clubId: clubMembership.clubId,
			})
			.from(clubMembership)
			.where(
				and(
					eq(clubMembership.userId, context.user.id),
					or(eq(clubMembership.role, "MANAGER"), eq(clubMembership.role, "CLUB_OWNER")),
				),
			);

		return response.json({
			clubIds: managedClubs.map((m) => m.clubId),
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get managed clubs",
			description: "Get list of club IDs managed by current user",
			response: {
				200: z.object({
					clubIds: z.array(z.string()),
				}),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/membership",
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
		schema: {
			tags: ["Clubs"],
			summary: "Check club membership",
			description: "Check if current user is a member of the club",
			params: z.object({
				id: z.string(),
			}),
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

clubsRouter.get(
	"/api/clubs/:id/has-owner",
	async ({ params, response }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const ownerData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.role, "CLUB_OWNER")))
			.limit(1);

		return response.json({ hasOwner: !!ownerData[0] });
	},
	{
		auth: false,
		schema: {
			tags: ["Clubs"],
			summary: "Check if club has owner",
			description: "Check if a club has an owner",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					hasOwner: z.boolean(),
				}),
				400: z.object({ error: z.string() }),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/count",
	async ({ query, response }) => {
		const isPrivate = query?.isPrivate;

		const whereClause =
			isPrivate === "true" || isPrivate === "false" ? eq(club.isPrivate, isPrivate === "true") : undefined;

		const totalData = await db.select({ count: count() }).from(club).where(whereClause);

		return response.json({ count: totalData[0]?.count || 0 });
	},
	{
		auth: false,
		schema: {
			tags: ["Clubs"],
			summary: "Count clubs",
			description: "Get count of clubs with optional filters",
			query: z.object({
				isPrivate: z.string().optional(),
			}),
			response: {
				200: z.object({
					count: z.number(),
				}),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:clubId/events",
	async ({ params, response, context, query }) => {
		const clubId = params.clubId;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;
		const search = query?.search || "";
		const sortBy = query?.sortBy || "dateStart";
		const sortOrder = query?.sortOrder || "desc";

		const whereConditions = [eq(event.clubId, clubId)];

		if (search) {
			whereConditions.push(ilike(event.name, `%${search}%`));
		}

		const whereClause = and(...whereConditions);

		let orderByClause: typeof event.dateStart | typeof event.name | ReturnType<typeof desc>;
		if (sortBy === "name") {
			orderByClause = sortOrder === "asc" ? event.name : desc(event.name);
		} else {
			orderByClause = sortOrder === "asc" ? event.dateStart : desc(event.dateStart);
		}

		const eventsData = await db
			.select()
			.from(event)
			.where(whereClause)
			.orderBy(orderByClause)
			.limit(perPage)
			.offset(offset);

		const events = await Promise.all(
			eventsData.map(async (e) => {
				const registrationCount = await db
					.select({ count: count() })
					.from(eventRegistration)
					.where(eq(eventRegistration.eventId, e.id));
				return {
					...e,
					gearRequirements: e.gearRequirements as z.infer<typeof baseEventSchema>["gearRequirements"],
					mapData: e.mapData as z.infer<typeof baseEventSchema>["mapData"],
					_count: {
						eventRegistration: Number(registrationCount[0]?.count || 0),
					},
				};
			}),
		);

		const totalData = await db.select({ count: count() }).from(event).where(whereClause);
		const total = totalData[0]?.count || 0;

		return response.json({
			events,
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
			summary: "Get club events",
			description: "Get events for a specific club with pagination, search, and sorting",
			params: z.object({
				clubId: z.string(),
			}),
			query: paginationQuerySchema.extend({
				search: z.string().optional(),
				sortBy: z.enum(["name", "dateStart"]).optional(),
				sortOrder: z.enum(["asc", "desc"]).optional(),
			}),
			response: {
				200: z.object({
					events: z.array(
						baseEventSchema.extend({
							_count: z.object({
								eventRegistration: z.number(),
							}),
						}),
					),
					pagination: paginationResponseSchema,
				}),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:clubId/events/count",
	async ({ params, response, query, context }) => {
		const clubId = params.clubId;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const search = query?.search || "";

		const whereConditions = [eq(event.clubId, clubId)];

		if (search) {
			whereConditions.push(ilike(event.name, `%${search}%`));
		}

		const whereClause = and(...whereConditions);

		const totalData = await db.select({ count: count() }).from(event).where(whereClause);
		const total = totalData[0]?.count || 0;

		return response.json({ count: total });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Count club events",
			description: "Count events for a specific club with optional search filter",
			params: z.object({
				clubId: z.string(),
			}),
			query: z.object({
				search: z.string().optional(),
			}),
			response: {
				200: z.object({
					count: z.number(),
				}),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/stats",
	async ({ params, context, response }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const clubData = await db.select({ createdAt: club.createdAt }).from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		const clubCreatedAt = clubData[0].createdAt;

		const membersOverTime = await db.execute(sql`
			WITH RECURSIVE dates AS (
				SELECT DATE(date_trunc('day', ${clubCreatedAt}::timestamp))::timestamp as date
				UNION ALL
				SELECT (date + INTERVAL '1 day')::timestamp
				FROM dates
				WHERE date < DATE(NOW())
			)
			SELECT 
				d.date::date as date,
				COUNT(DISTINCT cm.id)::int as count
			FROM dates d
			LEFT JOIN "ClubMembership" cm ON 
				DATE(cm."createdAt") <= d.date::date 
				AND cm."clubId" = ${clubId}
			GROUP BY d.date
			ORDER BY d.date ASC
		`);

		const roleDistribution = await db
			.select({
				role: clubMembership.role,
				count: count(),
			})
			.from(clubMembership)
			.where(eq(clubMembership.clubId, clubId))
			.groupBy(clubMembership.role);

		const eventsPerMonth = await db.execute(sql`
			WITH RECURSIVE months AS (
				SELECT DATE_TRUNC('month', NOW() - INTERVAL '11 months')::date as month
				UNION ALL
				SELECT (month + INTERVAL '1 month')::date
				FROM months
				WHERE month < DATE_TRUNC('month', NOW())
			)
			SELECT 
				m.month,
				COUNT(e.id)::int as count
			FROM months m
			LEFT JOIN "Event" e ON 
				DATE_TRUNC('month', e."dateStart") = m.month 
				AND e."clubId" = ${clubId}
			GROUP BY m.month
			ORDER BY m.month ASC
		`);

		const recentEventsData = await db
			.select()
			.from(event)
			.where(eq(event.clubId, clubId))
			.orderBy(desc(event.dateStart))
			.limit(10);

		const recentEvents = await Promise.all(
			recentEventsData.map(async (e) => {
				const registrationCount = await db
					.select({ count: count() })
					.from(eventRegistration)
					.where(eq(eventRegistration.eventId, e.id));
				return {
					...e,
					gearRequirements: e.gearRequirements as z.infer<typeof baseEventSchema>["gearRequirements"],
					mapData: e.mapData as z.infer<typeof baseEventSchema>["mapData"],
					_count: {
						eventRegistration: Number(registrationCount[0]?.count || 0),
					},
				};
			}),
		);

		return response.json({
			members: (membersOverTime as Array<{ date: Date | string; count: number | string }>).map((row) => ({
				date: row.date instanceof Date ? row.date.toISOString() : String(row.date),
				count: Number(row.count),
			})),
			roles: roleDistribution.map((r) => ({
				role: r.role,
				_count: Number(r.count),
			})),
			events: (eventsPerMonth as Array<{ month: Date | string; count: number | string }>).map((row) => ({
				month: row.month instanceof Date ? row.month.toISOString() : String(row.month),
				count: Number(row.count),
			})),
			recentEvents,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club statistics",
			description:
				"Get club statistics including members over time, role distribution, events per month, and recent events",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					members: z.array(
						z.object({
							date: z.string(),
							count: z.number(),
						}),
					),
					roles: z.array(
						z.object({
							role: z.string(),
							_count: z.number(),
						}),
					),
					events: z.array(
						z.object({
							month: z.string(),
							count: z.number(),
						}),
					),
					recentEvents: z.array(
						baseEventSchema.extend({
							_count: z.object({
								eventRegistration: z.number(),
							}),
						}),
					),
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/audit-logs",
	async ({ params, context, query, response }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;
		const search = query?.search || "";
		const actionType = query?.actionType;

		const whereConditions = [eq(clubAuditLog.clubId, clubId)];

		if (actionType) {
			whereConditions.push(eq(clubAuditLog.actionType, actionType));
		}

		if (search) {
			const searchCondition = or(
				ilike(clubAuditLog.actionType, `%${search}%`),
				sql`CAST(${clubAuditLog.actionData} AS TEXT) ILIKE ${`%${search}%`}`,
			);
			if (searchCondition) {
				whereConditions.push(searchCondition);
			}
		}

		const whereClause = and(...whereConditions);

		const logs = await db
			.select({
				id: clubAuditLog.id,
				createdAt: clubAuditLog.createdAt,
				userId: clubAuditLog.userId,
				clubId: clubAuditLog.clubId,
				actionType: clubAuditLog.actionType,
				actionData: clubAuditLog.actionData,
				ipAddress: clubAuditLog.ipAddress,
				userAgent: clubAuditLog.userAgent,
				user: {
					id: user.id,
					name: user.name,
					email: user.email,
				},
			})
			.from(clubAuditLog)
			.leftJoin(user, eq(clubAuditLog.userId, user.id))
			.where(whereClause)
			.orderBy(desc(clubAuditLog.createdAt))
			.limit(perPage)
			.offset(offset);

		const totalData = await db.select({ count: count() }).from(clubAuditLog).where(whereClause);
		const total = totalData[0]?.count || 0;

		return response.json({
			logs: logs.map((log) => ({
				...log,
				actionData: log.actionData as Record<string, unknown>,
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
			summary: "Get club audit logs",
			description: "Get audit logs for a club with pagination, search, and filtering by action type",
			params: z.object({
				id: z.string(),
			}),
			query: paginationQuerySchema.extend({
				search: z.string().optional(),
				actionType: z.string().optional(),
			}),
			response: {
				200: z.object({
					logs: z.array(
						z.object({
							id: z.string(),
							createdAt: z.string(),
							userId: z.string().nullable(),
							clubId: z.string(),
							actionType: z.string(),
							actionData: z.record(z.string(), z.unknown()),
							ipAddress: z.string().nullable(),
							userAgent: z.string().nullable(),
							user: z
								.object({
									id: z.string(),
									name: z.string(),
									email: z.string(),
								})
								.nullable(),
						}),
					),
					pagination: paginationResponseSchema,
				}),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

const addMemberBodySchema = z.object({
	userId: z.string(),
	role: z.enum(["USER", "MANAGER", "CLUB_OWNER"]).optional(),
});

clubsRouter.post(
	"/api/clubs/:id/members",
	async ({ params, context, body, response }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const existingMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, body.userId)))
			.limit(1);

		if (existingMembershipData[0]) {
			throw apiError.validation("User is already a member of this club");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
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
				role: body.role || "USER",
			},
			userId: context.user.id,
		});

		if (!newMembership[0]) {
			throw apiError.internal("Failed to add member");
		}

		return response.json({
			success: true,
			membership: newMembership[0],
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Add member to club",
			description: "Add a member to a club",
			params: z.object({
				id: z.string(),
			}),
			body: addMemberBodySchema,
			response: {
				200: z.object({
					success: z.boolean(),
					membership: baseClubMembershipSchema,
				}),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

const STORAGE_LIMITS = {
	CLUB_TOTAL: 1024 * 1024 * 1024,
	USER_DAILY: 50 * 1024 * 1024,
} as const;

clubsRouter.get(
	"/api/clubs/:id/storage-quota",
	async ({ params, context, response }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const [postsUsage, receiptsUsage] = await Promise.all([
			db.select({ images: post.images }).from(post).where(eq(post.clubId, clubId)),
			db
				.select({ receiptUrls: clubPurchase.receiptUrls })
				.from(clubPurchase)
				.where(eq(clubPurchase.clubId, clubId)),
		]);

		const postImageSizes = postsUsage.flatMap((p) =>
			(p.images as string[]).map((imageKey) => extractSizeFromKey(imageKey)),
		);

		const receiptSizes = receiptsUsage.flatMap((purchase) =>
			(purchase.receiptUrls as string[]).map((receiptKey) => extractSizeFromKey(receiptKey)),
		);

		const currentUsage = [...postImageSizes, ...receiptSizes].reduce((total, size) => total + size, 0);
		const limit = STORAGE_LIMITS.CLUB_TOTAL;
		const remaining = Math.max(0, limit - currentUsage);

		return response.json({
			currentUsage,
			limit,
			remaining,
			allowed: currentUsage < limit,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Check club storage quota",
			description: "Check club storage quota usage",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					currentUsage: z.number(),
					limit: z.number(),
					remaining: z.number(),
					allowed: z.boolean(),
				}),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/instagram/auth-url",
	async ({ params, response, context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		if (!env.FACEBOOK_APP_ID) {
			throw apiError.internal("Facebook App ID not configured");
		}

		const redirectUri = `${env.BETTER_AUTH_URL}/api/club/instagram/callback`;
		const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
		authUrl.searchParams.set("client_id", env.FACEBOOK_APP_ID);
		authUrl.searchParams.set("redirect_uri", redirectUri);
		authUrl.searchParams.set("scope", "pages_show_list,instagram_basic,pages_read_engagement");
		authUrl.searchParams.set("state", clubId);

		return response.json({ authUrl: authUrl.toString() });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get Instagram authorization URL",
			description: "Get Instagram authorization URL for club",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					authUrl: z.string(),
				}),
				...responseSchema([400, 401, 403, 500], z.object({ error: z.string() })),
			},
		},
	},
);

clubsRouter.post(
	"/api/clubs/:id/instagram/disconnect",
	async ({ params, response, context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		await db
			.update(club)
			.set({
				instagramAccessToken: null,
				instagramUsername: null,
				instagramConnected: false,
				instagramTokenExpiry: null,
				instagramBusinessId: null,
				facebookPageId: null,
				instagramTokenType: null,
				instagramRefreshToken: null,
				instagramProfilePictureUrl: null,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(club.id, clubId));

		await logClubAudit({
			clubId,
			actionType: "INSTAGRAM_DISCONNECT",
			actionData: {
				success: true,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Disconnect Instagram account",
			description: "Disconnect Instagram account from club",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

clubsRouter.get(
	"/api/clubs/:id/instagram/check-token",
	async ({ params, response, context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const clubData = await db
			.select({
				instagramAccessToken: club.instagramAccessToken,
				instagramBusinessId: club.instagramBusinessId,
				instagramTokenExpiry: club.instagramTokenExpiry,
				facebookPageId: club.facebookPageId,
				instagramTokenType: club.instagramTokenType,
			})
			.from(club)
			.where(eq(club.id, clubId))
			.limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		const clubRecord = clubData[0];

		if (!clubRecord.instagramAccessToken || !clubRecord.instagramBusinessId) {
			return response.json({ token: null, igBusinessId: null });
		}

		if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) {
			throw apiError.internal("Facebook credentials not configured");
		}

		try {
			const appAccessToken = `${env.FACEBOOK_APP_ID}|${env.FACEBOOK_APP_SECRET}`;

			if (clubRecord.instagramTokenType === "PERMANENT") {
				const debugResponse = await fetch(
					`https://graph.facebook.com/v19.0/debug_token?input_token=${clubRecord.instagramAccessToken}&access_token=${appAccessToken}`,
				);

				if (!debugResponse.ok) {
					return response.json({ token: null, igBusinessId: null });
				}

				const debugData = (await debugResponse.json()) as {
					data?: { is_valid?: boolean };
				};

				if (!debugData.data?.is_valid) {
					return response.json({ token: null, igBusinessId: null });
				}

				return response.json({
					token: clubRecord.instagramAccessToken,
					igBusinessId: clubRecord.instagramBusinessId,
				});
			}

			const shouldRefreshToken =
				!clubRecord.instagramTokenExpiry ||
				new Date(clubRecord.instagramTokenExpiry) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

			if (shouldRefreshToken && clubRecord.facebookPageId) {
				const pageTokenResponse = await fetch(
					`https://graph.facebook.com/v19.0/${clubRecord.facebookPageId}?fields=access_token&access_token=${clubRecord.instagramAccessToken}`,
				);

				if (pageTokenResponse.ok) {
					const pageTokenData = (await pageTokenResponse.json()) as {
						access_token?: string;
					};
					const nonExpiringToken = pageTokenData.access_token;

					if (nonExpiringToken) {
						await db
							.update(club)
							.set({
								instagramAccessToken: nonExpiringToken,
								instagramTokenExpiry: null,
								instagramTokenType: "PERMANENT",
								updatedAt: new Date().toISOString(),
							})
							.where(eq(club.id, clubId));

						return response.json({
							token: nonExpiringToken,
							igBusinessId: clubRecord.instagramBusinessId,
						});
					}
				}
			}

			const debugResponse = await fetch(
				`https://graph.facebook.com/v19.0/debug_token?input_token=${clubRecord.instagramAccessToken}&access_token=${appAccessToken}`,
			);

			if (!debugResponse.ok) {
				return response.json({ token: null, igBusinessId: null });
			}

			const debugData = (await debugResponse.json()) as {
				data?: { is_valid?: boolean; expires_at?: number };
			};

			if (!debugData.data?.is_valid) {
				return response.json({ token: null, igBusinessId: null });
			}

			if (debugData.data?.expires_at) {
				await db
					.update(club)
					.set({
						instagramTokenExpiry: new Date(debugData.data.expires_at * 1000).toISOString(),
						updatedAt: new Date().toISOString(),
					})
					.where(eq(club.id, clubId));
			}

			return response.json({
				token: clubRecord.instagramAccessToken,
				igBusinessId: clubRecord.instagramBusinessId,
			});
		} catch {
			return response.json({
				token: clubRecord.instagramAccessToken,
				igBusinessId: clubRecord.instagramBusinessId,
			});
		}
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Check and refresh Instagram token",
			description: "Check Instagram token validity and refresh if needed",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					token: z.string().nullable(),
					igBusinessId: z.string().nullable(),
				}),
				...responseSchema([400, 401, 403, 404, 500], z.object({ error: z.string() })),
			},
		},
	},
);

export { clubsRouter };
