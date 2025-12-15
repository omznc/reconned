import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { clubRule, event } from "../drizzle/schema";

export const paginationQuerySchema = z.object({
	page: z
		.string()
		.optional()
		.default("1")
		.transform((val) => Number.parseInt(val, 10))
		.refine((val) => val > 0, {
			message: "Page must be greater than 0",
		}),
	perPage: z
		.string()
		.optional()
		.default("25")
		.transform((val) => Number.parseInt(val, 10))
		.refine((val) => val > 0 && val <= 100, {
			message: "perPage must be between 1 and 100",
		}),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginationResponseSchema = z.object({
	page: z.number(),
	perPage: z.number(),
	total: z.number(),
	totalPages: z.number(),
});

export type PaginationResponse = z.infer<typeof paginationResponseSchema>;

// Base schemas for automatic casting
export const baseEventSchema = createSelectSchema(event);
export const baseClubRuleSchema = createSelectSchema(clubRule);

/**
 * Utility to automatically cast JSONB fields based on schema definitions
 * Eliminates the need for manual casting like `field as z.infer<typeof schema>["field"]`
 */
export const createCastedSelect = <TSchema extends ReturnType<typeof createSelectSchema>>(schema: TSchema) => {
	type SchemaType = z.infer<TSchema>;

	return <TResult extends Record<string, unknown>>(
		result: TResult,
	): TResult & {
		[K in keyof TResult]: K extends keyof SchemaType ? SchemaType[K] : TResult[K];
	} => {
		const casted = { ...result } as TResult;

		// Auto-cast JSONB fields based on schema
		for (const [key, value] of Object.entries(result)) {
			if (key in schema.shape && value !== null && value !== undefined) {
				// If the schema field has a known type, cast it
				// This handles jsonb().array() and jsonb() fields automatically
				if (typeof value === "object" || Array.isArray(value)) {
					casted[key] = value;
				}
			}
		}

		return casted;
	};
};

/**
 * Batch casting utility for arrays of results
 */
export const createCastedSelectMany = <TSchema extends ReturnType<typeof createSelectSchema>>(schema: TSchema) => {
	const castSingle = createCastedSelect(schema);

	return <TResult extends Record<string, unknown>>(
		results: TResult[],
	): Array<
		TResult & {
			[K in keyof TResult]: K extends keyof z.infer<TSchema> ? z.infer<TSchema>[K] : TResult[K];
		}
	> => {
		return results.map(castSingle);
	};
};

// Pre-built casters for common schemas
export const castEventResult = createCastedSelect(baseEventSchema);
export const castEventResults = createCastedSelectMany(baseEventSchema);

export const castClubRuleResult = createCastedSelect(baseClubRuleSchema);
export const castClubRuleResults = createCastedSelectMany(baseClubRuleSchema);
