import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { clubRule, event } from "../drizzle/schema";

// Json type for JSONB fields - use unknown for simplicity since jsonb can be anything
const jsonSchema = z.unknown();

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

// The website-URL rules live in `./validation-contracts`, which the web app also imports so both
// sides validate identically. Re-exported here so existing `lib/schemas` importers are unaffected.
export { httpsUrl } from "./validation-contracts";

// Base schemas for type validation and inference
export const baseEventSchema = createSelectSchema(event).extend({
	gearRequirements: z.array(jsonSchema).nullable(),
	mapData: jsonSchema.nullable(),
});
export const baseClubRuleSchema = createSelectSchema(clubRule);
