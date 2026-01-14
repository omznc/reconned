import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import * as z from "zod";
import { alliance, clubAlliance, country } from "../../drizzle/schema";
import { db } from "../../lib/db";
import { apiError } from "../../lib/errors";
import { Router, responseSchema } from "../../lib/router";
import { paginationQuerySchema, paginationResponseSchema } from "../../lib/schemas";

const adminAlliancesRouter = new Router();

const allianceSchema = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string().nullable(),
	link: z.string().nullable(),
	countryId: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

const allianceWithRelationsSchema = allianceSchema.extend({
	country: z.object({
		id: z.number(),
		name: z.string(),
		iso2: z.string(),
		iso3: z.string(),
	}),
	clubAlliances: z
		.array(
			z.object({
				club: z.object({
					id: z.string(),
					name: z.string(),
					location: z.string().nullable().optional(),
					logo: z.string().nullable().optional(),
				}),
			}),
		)
		.optional(),
});

// Get all alliances
adminAlliancesRouter.get(
	"/admin/alliances",
	async ({ query, response, context: _context }) => {
		const { page = 1, perPage = 25, search = "", sortBy = "createdAt", sortOrder = "desc" } = query || {};
		const offset = (page - 1) * perPage;

		const whereConditions = [];

		if (search) {
			whereConditions.push(or(ilike(alliance.name, `%${search}%`), ilike(alliance.description, `%${search}%`)));
		}

		const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		let orderBy: typeof alliance.name | typeof alliance.createdAt | ReturnType<typeof desc>;
		if (sortBy === "name") {
			orderBy = sortOrder === "desc" ? desc(alliance.name) : alliance.name;
		} else {
			orderBy = sortOrder === "desc" ? desc(alliance.createdAt) : alliance.createdAt;
		}

		const alliances = await db.query.alliance.findMany({
			where,
			with: {
				country: {
					columns: {
						id: true,
						name: true,
						iso2: true,
						iso3: true,
					},
				},
				clubAlliances: {
					with: {
						club: {
							columns: {
								id: true,
								name: true,
							},
						},
					},
				},
			},
			orderBy: [orderBy],
			limit: perPage,
			offset,
		});

		const total = await db.select({ count: count() }).from(alliance).where(where);

		return response.json({
			alliances,
			pagination: {
				page,
				perPage,
				total: total[0]?.count || 0,
				totalPages: Math.ceil((total[0]?.count || 0) / perPage),
			},
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "List all alliances",
			description: "Admin endpoint to list all alliances with pagination, search, and sorting",
			query: paginationQuerySchema.extend({
				search: z.string().optional(),
				sortBy: z.enum(["name", "createdAt"]).optional(),
				sortOrder: z.enum(["asc", "desc"]).optional(),
			}),
			response: {
				200: z.object({
					alliances: z.array(allianceWithRelationsSchema),
					pagination: paginationResponseSchema,
				}),
				...responseSchema([401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

// Get single alliance
adminAlliancesRouter.get(
	"/admin/alliances/:id",
	async ({ params, response }) => {
		const allianceId = Number(params.id);

		if (!allianceId || Number.isNaN(allianceId)) {
			throw apiError.validation("Alliance ID is required");
		}

		const result = await db.query.alliance.findFirst({
			where: eq(alliance.id, allianceId),
			with: {
				country: {
					columns: {
						id: true,
						name: true,
						iso2: true,
						iso3: true,
					},
				},
				clubAlliances: {
					with: {
						club: {
							columns: {
								id: true,
								name: true,
								location: true,
								logo: true,
							},
						},
					},
				},
			},
		});

		if (!result) {
			throw apiError.notFound("Alliance not found");
		}

		return response.json({ alliance: result });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Get alliance by ID",
			description: "Admin endpoint to get a single alliance with its details",
			params: z.object({
				id: z.coerce.number(),
			}),
			response: {
				200: z.object({
					alliance: allianceWithRelationsSchema,
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

// Create alliance
adminAlliancesRouter.post(
	"/admin/alliances",
	async ({ body, response }) => {
		// Verify country exists
		const countryExists = await db.query.country.findFirst({
			where: eq(country.id, body.countryId),
		});

		if (!countryExists) {
			throw apiError.validation("Country not found");
		}

		const [newAlliance] = await db
			.insert(alliance)
			.values({
				name: body.name,
				description: body.description || null,
				link: body.link || null,
				countryId: body.countryId,
				updatedAt: new Date().toISOString(),
			})
			.returning();

		if (!newAlliance) {
			throw apiError.internal("Failed to create alliance");
		}

		return response.json({ alliance: newAlliance });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Create alliance",
			description: "Admin endpoint to create a new alliance",
			body: z.object({
				name: z.string().min(1).max(100),
				description: z.string().max(1000).optional(),
				link: z.string().url().or(z.literal("")).optional(),
				countryId: z.number(),
			}),
			response: {
				200: z.object({
					alliance: allianceSchema,
				}),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

// Update alliance
adminAlliancesRouter.put(
	"/admin/alliances/:id",
	async ({ params, body, response }) => {
		const allianceId = Number(params.id);

		if (!allianceId || Number.isNaN(allianceId)) {
			throw apiError.validation("Alliance ID is required");
		}

		// Verify alliance exists
		const existingAlliance = await db.query.alliance.findFirst({
			where: eq(alliance.id, allianceId),
		});

		if (!existingAlliance) {
			throw apiError.notFound("Alliance not found");
		}

		// If updating country, verify it exists
		if (body.countryId) {
			const countryExists = await db.query.country.findFirst({
				where: eq(country.id, body.countryId),
			});

			if (!countryExists) {
				throw apiError.validation("Country not found");
			}
		}

		const updateData: {
			name?: string;
			description?: string | null;
			link?: string | null;
			countryId?: number;
			updatedAt: string;
		} = {
			updatedAt: new Date().toISOString(),
		};

		if (body.name) {
			updateData.name = body.name;
		}
		if (body.description !== undefined) {
			updateData.description = body.description || null;
		}
		if (body.link !== undefined) {
			updateData.link = body.link || null;
		}
		if (body.countryId) {
			updateData.countryId = body.countryId;
		}

		const [updatedAlliance] = await db
			.update(alliance)
			.set(updateData)
			.where(eq(alliance.id, allianceId))
			.returning();

		if (!updatedAlliance) {
			throw apiError.internal("Failed to update alliance");
		}

		return response.json({ alliance: updatedAlliance });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Update alliance",
			description: "Admin endpoint to update an existing alliance",
			params: z.object({
				id: z.coerce.number(),
			}),
			body: z.object({
				name: z.string().min(1).max(100).optional(),
				description: z.string().max(1000).optional(),
				link: z.string().url().or(z.literal("")).optional(),
				countryId: z.number().optional(),
			}),
			response: {
				200: z.object({
					alliance: allianceSchema,
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

// Delete alliance
adminAlliancesRouter.delete(
	"/admin/alliances/:id",
	async ({ params, response }) => {
		const allianceId = Number(params.id);

		if (!allianceId || Number.isNaN(allianceId)) {
			throw apiError.validation("Alliance ID is required");
		}

		// Verify alliance exists
		const existingAlliance = await db.query.alliance.findFirst({
			where: eq(alliance.id, allianceId),
		});

		if (!existingAlliance) {
			throw apiError.notFound("Alliance not found");
		}

		// Delete all club alliances first (cascade should handle this, but explicit is better)
		await db.delete(clubAlliance).where(eq(clubAlliance.allianceId, allianceId));

		// Delete the alliance
		await db.delete(alliance).where(eq(alliance.id, allianceId));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Delete alliance",
			description: "Admin endpoint to delete an alliance and its club associations",
			params: z.object({
				id: z.coerce.number(),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

// Add club to alliance
adminAlliancesRouter.post(
	"/admin/alliances/:id/clubs",
	async ({ params, body, response }) => {
		const allianceId = Number(params.id);

		if (!allianceId || Number.isNaN(allianceId)) {
			throw apiError.validation("Alliance ID is required");
		}

		const existingAlliance = await db.query.alliance.findFirst({
			where: eq(alliance.id, allianceId),
		});

		if (!existingAlliance) {
			throw apiError.notFound("Alliance not found");
		}

		const existingRelation = await db.query.clubAlliance.findFirst({
			where: and(eq(clubAlliance.clubId, body.clubId), eq(clubAlliance.allianceId, allianceId)),
		});

		if (existingRelation) {
			throw apiError.conflict("Club is already in this alliance");
		}

		const [newRelation] = await db
			.insert(clubAlliance)
			.values({
				clubId: body.clubId,
				allianceId,
			})
			.returning();

		if (!newRelation) {
			throw apiError.internal("Failed to add club to alliance");
		}

		return response.json({ clubAlliance: newRelation });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Add club to alliance",
			description: "Admin endpoint to add a club to an alliance",
			params: z.object({
				id: z.coerce.number(),
			}),
			body: z.object({
				clubId: z.string(),
			}),
			response: {
				200: z.object({
					clubAlliance: z.object({
						id: z.number(),
						clubId: z.string(),
						allianceId: z.number(),
					}),
				}),
				...responseSchema([400, 401, 403, 404, 409], z.object({ error: z.string() })),
			},
		},
	},
);

// Remove club from alliance
adminAlliancesRouter.delete(
	"/admin/alliances/:id/clubs/:clubId",
	async ({ params, response }) => {
		const allianceId = Number(params.id);
		const clubId = params.clubId;

		if (!allianceId || Number.isNaN(allianceId)) {
			throw apiError.validation("Alliance ID is required");
		}

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const existingRelation = await db.query.clubAlliance.findFirst({
			where: and(eq(clubAlliance.clubId, clubId), eq(clubAlliance.allianceId, allianceId)),
		});

		if (!existingRelation) {
			throw apiError.notFound("Club is not in this alliance");
		}

		await db.delete(clubAlliance).where(eq(clubAlliance.id, existingRelation.id));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Remove club from alliance",
			description: "Admin endpoint to remove a club from an alliance",
			params: z.object({
				id: z.coerce.number(),
				clubId: z.string(),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

export { adminAlliancesRouter };
