import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { clubRule, event } from "../drizzle/schema";

// Json type for JSONB fields - use unknown for simplicity since jsonb can be anything
const jsonSchema = z.unknown();

/**
 * Which tile a club logo is framed on. Written at upload time from the logo's
 * own pixels and overridable by the club; `null` means "decide automatically",
 * which is what every club uploaded before the analysis existed says.
 */
export const logoTileSchema = z.enum(["paper", "ink"]).nullable().optional();

/** The same value on the way out, where it is always present but may be null. */
export const logoTileResponseSchema = z.enum(["paper", "ink"]).nullable();

export type LogoTile = z.infer<typeof logoTileResponseSchema>;

/**
 * Narrows the raw text column to the two values the response schema allows.
 * Anything else — including the null every pre-analysis club carries — means
 * "no stored preference", which the client reads as paper.
 */
export function logoTileOf(value: string | null | undefined): LogoTile {
	return value === "paper" || value === "ink" ? value : null;
}

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
