import { z } from "zod";

/**
 * Shared pagination query schema
 * Converts string query params to integers and validates values
 */
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

/**
 * Type for pagination query parameters
 */
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Shared pagination response schema
 * Standard structure for paginated API responses
 */
export const paginationResponseSchema = z.object({
	page: z.number(),
	perPage: z.number(),
	total: z.number(),
	totalPages: z.number(),
});

/**
 * Type for pagination response
 */
export type PaginationResponse = z.infer<typeof paginationResponseSchema>;
