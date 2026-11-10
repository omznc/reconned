import { apiError, Router, responseSchema } from "@reconned/router";
import { and, asc, count, eq, ilike, inArray } from "drizzle-orm";
import * as z from "zod";
import { alliance, clubAlliance } from "../drizzle/schema";
import { db } from "../lib/db";
import { logger } from "../lib/posthog";
import { paginationQuerySchema, paginationResponseSchema } from "../lib/schemas";

const allianceSchema = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string().nullable(),
	countryId: z.number(),
});

const allianceListItemSchema = allianceSchema.extend({
	link: z.string().nullable(),
	country: z.object({
		id: z.number(),
		name: z.string(),
		iso2: z.string(),
	}),
	_count: z.object({
		clubs: z.number(),
	}),
});

export const alliancesRouter = new Router();

alliancesRouter.get(
	"/alliances",
	async ({ context, query, response }) => {
		const { page = 1, perPage = 25, countryId, search } = query || {};
		const offset = (page - 1) * perPage;

		const conditions = [];
		if (countryId) conditions.push(eq(alliance.countryId, countryId));
		if (search) conditions.push(ilike(alliance.name, `%${search}%`));
		const where = conditions.length > 0 ? and(...conditions) : undefined;

		const [alliances, totalResult] = await Promise.all([
			db.query.alliance.findMany({
				where,
				columns: {
					id: true,
					name: true,
					description: true,
					link: true,
					countryId: true,
				},
				with: {
					country: {
						columns: {
							id: true,
							name: true,
							iso2: true,
						},
					},
				},
				orderBy: [asc(alliance.name)],
				limit: perPage,
				offset,
			}),
			db.select({ count: count() }).from(alliance).where(where),
		]);

		const clubCounts = alliances.length
			? await db
					.select({ allianceId: clubAlliance.allianceId, count: count() })
					.from(clubAlliance)
					.where(
						inArray(
							clubAlliance.allianceId,
							alliances.map((a) => a.id),
						),
					)
					.groupBy(clubAlliance.allianceId)
			: [];
		const clubCountByAlliance = new Map(clubCounts.map((c) => [c.allianceId, c.count]));

		const total = totalResult[0]?.count ?? 0;

		logger.emit({
			severityText: "info",
			body: "Listed alliances",
			attributes: {
				country_id: countryId ?? null,
				alliance_count: alliances.length,
				request_id: context.requestId,
			},
		});

		return response.json({
			alliances: alliances.map((a) => ({
				...a,
				_count: { clubs: clubCountByAlliance.get(a.id) ?? 0 },
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
		cache: {
			key: "alliances",
			ttl: 300,
			swr: 1800,
			varyByQuery: ["page", "perPage", "countryId", "search"],
		},
		schema: {
			tags: ["Alliances"],
			summary: "List alliances",
			description:
				"List alliances with pagination, optionally filtered by country. Use list_countries to look up a country's ID first.",
			query: paginationQuerySchema.extend({
				countryId: z.coerce.number().int().positive().optional(),
				search: z.string().max(100).optional(),
			}),
			response: {
				200: z.object({
					alliances: z.array(allianceListItemSchema),
					pagination: paginationResponseSchema,
				}),
			},
			mcpTool: true,
		},
	},
);

alliancesRouter.get(
	"/alliances/:countryId",
	async ({ context, params, response }) => {
		const countryId = Number(params.countryId);

		if (!countryId || Number.isNaN(countryId)) {
			logger.emit({
				severityText: "warn",
				body: "Invalid country ID provided",
				attributes: {
					country_id: params.countryId,
					request_id: context.requestId,
				},
			});
			throw apiError.validation("Country ID is required and must be a valid number");
		}

		const alliances = await db.query.alliance.findMany({
			where: eq(alliance.countryId, countryId),
			columns: {
				id: true,
				name: true,
				description: true,
				countryId: true,
			},
			orderBy: [asc(alliance.name)],
		});

		logger.emit({
			severityText: "info",
			body: "Retrieved alliances by country",
			attributes: {
				country_id: countryId,
				alliance_count: alliances.length,
				request_id: context.requestId,
			},
		});

		return response.json({ alliances });
	},
	{
		schema: {
			tags: ["Alliances"],
			summary: "Get alliances by country",
			description: "Returns a list of alliances for a specific country",
			params: z.object({
				countryId: z.coerce.number(),
			}),
			response: {
				200: z.object({
					alliances: z.array(allianceSchema),
				}),
				...responseSchema([400], z.object({ error: z.string() })),
			},
		},
	},
);
