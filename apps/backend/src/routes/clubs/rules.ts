import { apiError, Router } from "@reconned/router";
import { and, eq } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { clubRule } from "../../drizzle/schema";
import { logClubAudit } from "../../lib/audit-logger";
import { bustClubPublicCaches, bustRouteCache } from "../../lib/cache-bust";
import { requireClubManager } from "../../lib/club-access";
import { getPublicClubRules, loadVisibleClub } from "../../lib/club-public";
import { db } from "../../lib/db";

const clubsRulesRouter = new Router();

const baseClubRuleSchema = createSelectSchema(clubRule);

const createRuleBodySchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().optional(),
	content: z.string(),
});

clubsRulesRouter.get(
	"/clubs/:id/public-rules",
	async ({ params, response, context }) => {
		if (!params.id) {
			throw apiError.validation("Club ID is required");
		}
		const { club: found } = await loadVisibleClub(params.id, context);

		return response.json({ rules: await getPublicClubRules(found.id) });
	},
	{
		auth: false,
		cache: {
			key: "club:{id}:public-rules",
			ttl: 300,
			swr: 1800,
			varyByUser: true,
		},
		schema: {
			tags: ["Clubs"],
			summary: "Get public club rules",
			description:
				"Rules a visitor may read. Rules have no public flag, so this returns only the rules attached to a public event, the same rules that event page shows. Club-level rules and rules of private events are not returned. `id` is a club id or slug.",
			params: z.object({ id: z.string() }),
			response: {
				200: z.object({
					rules: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							description: z.string().nullable(),
							content: z.string(),
							updatedAt: z.string(),
							eventId: z.string(),
							eventName: z.string(),
							eventSlug: z.string().nullable(),
						}),
					),
				}),
				404: z.object({ error: z.string() }),
			},
			mcpTool: { name: "list_public_club_rules", description: "List the public rules of a club" },
		},
	},
);

clubsRulesRouter.get(
	"/clubs/:id/rules",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		await requireClubManager(clubId, context.user.id);

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
			// Named explicitly: the generated name would collide with the by-ID route below,
			// and a collision silently drops one of the two tools.
			mcpTool: {
				name: "list_club_rules",
				description: "List all rules for a club",
			},
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

		await requireClubManager(clubId, context.user.id);

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

		await requireClubManager(clubId, context.user.id);

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

		await requireClubManager(clubId, context.user.id);

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

		// A rule attached to an event is served from `event:{id}:rules`, which this route's
		// params can't name — it only knows the club and the rule.
		if (updatedRule[0].eventId) {
			await bustRouteCache([`event:${updatedRule[0].eventId}`]);
			await bustClubPublicCaches(clubId);
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

		await requireClubManager(clubId, context.user.id);

		const ruleData = await db
			.select()
			.from(clubRule)
			.where(and(eq(clubRule.id, ruleId), eq(clubRule.clubId, clubId)))
			.limit(1);

		if (!ruleData[0]) {
			throw apiError.notFound("Rule not found");
		}

		await db.delete(clubRule).where(eq(clubRule.id, ruleId));

		// See the update route: an event-attached rule is cached under the event, not the club.
		if (ruleData[0].eventId) {
			await bustRouteCache([`event:${ruleData[0].eventId}`]);
			await bustClubPublicCaches(clubId);
		}

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
