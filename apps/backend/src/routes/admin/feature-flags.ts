import { and, count, desc, eq, ilike } from "drizzle-orm";
import * as z from "zod";
import { featureFlag } from "../../drizzle/schema";
import { db } from "../../lib/db";
import { apiError } from "../../lib/errors";
import { clearFeatureFlagsCache } from "../../lib/feature-flags";
import { logger } from "../../lib/posthog";
import { Router, responseSchema } from "../../lib/router";
import { paginationQuerySchema, paginationResponseSchema } from "../../lib/schemas";

const adminFeatureFlagsRouter = new Router();

const featureFlagSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	enabled: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

const createFeatureFlagSchema = z.object({
	name: z
		.string()
		.min(1, "Name is required")
		.regex(/^[A-Z_]+$/, "Name must be uppercase with underscores only (e.g., MY_FEATURE_FLAG)")
		.transform((val) => val.toUpperCase().replace(/[^A-Z_]/g, "_")),
	description: z.string().optional(),
	enabled: z.boolean().default(false),
});

const updateFeatureFlagSchema = z.object({
	name: z
		.string()
		.min(1)
		.regex(/^[A-Z_]+$/, "Name must be uppercase with underscores only (e.g., MY_FEATURE_FLAG)")
		.transform((val) => val.toUpperCase().replace(/[^A-Z_]/g, "_"))
		.optional(),
	description: z.string().optional(),
	enabled: z.boolean().optional(),
});

// List all feature flags (admin only)
adminFeatureFlagsRouter.get(
	"/admin/feature-flags",
	async ({ context, query, response }) => {
		const { page = 1, perPage = 25, search = "", sortBy = "createdAt", sortOrder = "desc" } = query || {};
		const offset = (page - 1) * perPage;

		const whereConditions = [];

		if (search) {
			whereConditions.push(ilike(featureFlag.name, `%${search}%`));
		}

		const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		let orderBy: typeof featureFlag.name | typeof featureFlag.createdAt | ReturnType<typeof desc>;
		if (sortBy === "name") {
			orderBy = sortOrder === "desc" ? desc(featureFlag.name) : featureFlag.name;
		} else {
			orderBy = sortOrder === "desc" ? desc(featureFlag.createdAt) : featureFlag.createdAt;
		}

		const flags = await db.select().from(featureFlag).where(where).orderBy(orderBy).limit(perPage).offset(offset);

		const total = await db.select({ count: count() }).from(featureFlag).where(where);

		logger.emit({
			severityText: "info",
			body: "Admin: Listed feature flags",
			attributes: {
				admin_user_id: context.user?.id,
				flag_count: flags.length,
				total_flags: total[0]?.count || 0,
				page,
				per_page: perPage,
				search,
				request_id: context.requestId,
			},
		});

		return response.json({
			featureFlags: flags,
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
			tags: ["Admin", "Feature Flags"],
			summary: "List all feature flags",
			description: "Admin endpoint to list all feature flags with pagination and search",
			query: paginationQuerySchema.extend({
				search: z.string().optional(),
				sortBy: z.enum(["name", "createdAt"]).optional(),
				sortOrder: z.enum(["asc", "desc"]).optional(),
			}),
			response: {
				200: z.object({
					featureFlags: z.array(featureFlagSchema),
					pagination: paginationResponseSchema,
				}),
				...responseSchema([401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

// Get single feature flag (admin only)
adminFeatureFlagsRouter.get(
	"/admin/feature-flags/:id",
	async ({ params, response }) => {
		const flagId = params.id;
		if (!flagId) {
			throw apiError.validation("Feature flag ID is required");
		}

		const flag = await db.select().from(featureFlag).where(eq(featureFlag.id, flagId)).limit(1);

		if (!flag[0]) {
			throw apiError.notFound("Feature flag");
		}

		return response.json(flag[0]);
	},
	{
		auth: true,
		schema: {
			tags: ["Admin", "Feature Flags"],
			summary: "Get feature flag details",
			description: "Admin endpoint to get a single feature flag",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: featureFlagSchema,
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

// Create feature flag (admin only)
adminFeatureFlagsRouter.post(
	"/admin/feature-flags",
	async ({ context, body, response }) => {
		const { name, description, enabled } = body;

		const newFlag = await db
			.insert(featureFlag)
			.values({
				name,
				description: description || null,
				enabled: enabled ?? false,
			})
			.returning();

		if (!newFlag[0]) {
			logger.emit({
				severityText: "error",
				body: "Admin: Failed to create feature flag",
				attributes: {
					flag_name: name,
					admin_user_id: context.user?.id,
					request_id: context.requestId,
				},
			});
			throw apiError.validation("Failed to create feature flag");
		}

		// Clear cache for the new flag
		await clearFeatureFlagsCache(newFlag[0].name);

		logger.emit({
			severityText: "info",
			body: "Admin: Created feature flag",
			attributes: {
				flag_id: newFlag[0].id,
				flag_name: newFlag[0].name,
				enabled: newFlag[0].enabled,
				admin_user_id: context.user?.id,
				request_id: context.requestId,
			},
		});

		return response.json(newFlag[0]);
	},
	{
		auth: true,
		schema: {
			tags: ["Admin", "Feature Flags"],
			summary: "Create feature flag",
			description: "Admin endpoint to create a new feature flag",
			body: createFeatureFlagSchema,
			response: {
				200: featureFlagSchema,
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

// Update feature flag (admin only)
adminFeatureFlagsRouter.put(
	"/admin/feature-flags/:id",
	async ({ context, params, body, response }) => {
		const flagId = params.id;
		if (!flagId) {
			throw apiError.validation("Feature flag ID is required");
		}

		const existingFlag = await db.select().from(featureFlag).where(eq(featureFlag.id, flagId)).limit(1);

		if (!existingFlag[0]) {
			logger.emit({
				severityText: "warn",
				body: "Admin: Feature flag not found for update",
				attributes: {
					flag_id: flagId,
					admin_user_id: context.user?.id,
					request_id: context.requestId,
				},
			});
			throw apiError.notFound("Feature flag");
		}

		const previousEnabled = existingFlag[0].enabled;
		const updatedFlag = await db
			.update(featureFlag)
			.set({
				...body,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(featureFlag.id, flagId))
			.returning();

		if (!updatedFlag[0]) {
			logger.emit({
				severityText: "error",
				body: "Admin: Failed to update feature flag",
				attributes: {
					flag_id: flagId,
					flag_name: existingFlag[0].name,
					admin_user_id: context.user?.id,
					request_id: context.requestId,
				},
			});
			throw apiError.validation("Failed to update feature flag");
		}

		// Clear cache for the updated flag
		await clearFeatureFlagsCache(updatedFlag[0].name);

		logger.emit({
			severityText: "info",
			body: "Admin: Updated feature flag",
			attributes: {
				flag_id: updatedFlag[0].id,
				flag_name: updatedFlag[0].name,
				enabled: updatedFlag[0].enabled,
				previous_enabled: previousEnabled,
				admin_user_id: context.user?.id,
				request_id: context.requestId,
			},
		});

		return response.json(updatedFlag[0]);
	},
	{
		auth: true,
		schema: {
			tags: ["Admin", "Feature Flags"],
			summary: "Update feature flag",
			description: "Admin endpoint to update a feature flag",
			params: z.object({
				id: z.string(),
			}),
			body: updateFeatureFlagSchema,
			response: {
				200: featureFlagSchema,
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

// Delete feature flag (admin only)
adminFeatureFlagsRouter.delete(
	"/admin/feature-flags/:id",
	async ({ context, params, response }) => {
		const flagId = params.id;
		if (!flagId) {
			throw apiError.validation("Feature flag ID is required");
		}

		const existingFlag = await db.select().from(featureFlag).where(eq(featureFlag.id, flagId)).limit(1);

		if (!existingFlag[0]) {
			logger.emit({
				severityText: "warn",
				body: "Admin: Feature flag not found for deletion",
				attributes: {
					flag_id: flagId,
					admin_user_id: context.user?.id,
					request_id: context.requestId,
				},
			});
			throw apiError.notFound("Feature flag");
		}

		const flagName = existingFlag[0].name;
		const flagEnabled = existingFlag[0].enabled;

		// Clear cache before deleting
		await clearFeatureFlagsCache(existingFlag[0].name);

		await db.delete(featureFlag).where(eq(featureFlag.id, flagId));

		logger.emit({
			severityText: "info",
			body: "Admin: Deleted feature flag",
			attributes: {
				flag_id: flagId,
				flag_name: flagName,
				enabled: flagEnabled,
				admin_user_id: context.user?.id,
				request_id: context.requestId,
			},
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin", "Feature Flags"],
			summary: "Delete feature flag",
			description: "Admin endpoint to delete a feature flag",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

export { adminFeatureFlagsRouter };
