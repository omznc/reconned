import { apiError, Router } from "@reconned/router";
import { and, eq } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { clubMembership, clubRule } from "../../drizzle/schema";
import { logClubAudit } from "../../lib/audit-logger";
import { db } from "../../lib/db";

const clubsRulesRouter = new Router();

const baseClubRuleSchema = createSelectSchema(clubRule);

const createRuleBodySchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().optional(),
	content: z.string(),
});

clubsRulesRouter.get(
	"/clubs/:id/rules",
	async ({ params, response, context }) => {
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
			mcpTool: true,
		},
	},
);

clubsRulesRouter.get(
	"/clubs/:id/rules/:ruleId",
	async ({ params, response, context }) => {
		const clubId = params.id;
		const ruleId = params.ruleId;

		if (!clubId || !ruleId) {
			throw apiError.validation("Club ID and Rule ID are required");
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
			mcpTool: true,
		},
	},
);

clubsRulesRouter.post(
	"/clubs/:id/rules",
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
			mcpTool: true,
		},
	},
);

clubsRulesRouter.put(
	"/clubs/:id/rules/:ruleId",
	async ({ params, response, context, body }) => {
		const clubId = params.id;
		const ruleId = params.ruleId;

		if (!clubId || !ruleId) {
			throw apiError.validation("Club ID and Rule ID are required");
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
			mcpTool: true,
		},
	},
);

clubsRulesRouter.delete(
	"/clubs/:id/rules/:ruleId",
	async ({ params, response, context }) => {
		const clubId = params.id;
		const ruleId = params.ruleId;

		if (!clubId || !ruleId) {
			throw apiError.validation("Club ID and Rule ID are required");
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
			mcpTool: true,
		},
	},
);

export { clubsRulesRouter };
