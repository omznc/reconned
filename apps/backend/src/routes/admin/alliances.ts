import { and, desc, eq } from "drizzle-orm";
import * as z from "zod";
import { alliance, clubAlliance, country } from "../../drizzle/schema";
import { db } from "../../lib/db";
import { apiError } from "../../lib/errors";
import { Router, responseSchema } from "../../lib/router";

const adminAlliancesRouter = new Router();

const allianceSchema = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string().nullable(),
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
				}),
			}),
		)
		.optional(),
});

// Get all alliances
adminAlliancesRouter.get(
	"/admin/alliances",
	async ({ request, response, context: _context }) => {
		const url = new URL(request.url);
		const countryIdParam = url.searchParams.get("countryId");
		const countryId = countryIdParam ? Number(countryIdParam) : undefined;

		const whereConditions = [];
		if (countryId) {
			whereConditions.push(eq(alliance.countryId, Number(countryId)));
		}

		const alliances = await db.query.alliance.findMany({
			where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
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
			orderBy: [desc(alliance.createdAt)],
		});

		return response.json({ alliances });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "List all alliances",
			description: "Admin endpoint to list all alliances with optional country filter",
			response: {
				200: z.object({
					alliances: z.array(allianceWithRelationsSchema),
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

export { adminAlliancesRouter };
