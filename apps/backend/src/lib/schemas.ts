import { z } from "zod";

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
