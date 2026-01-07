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

// Regex to validate domain names with at least one dot (TLD required)
// Allows alphanumeric, hyphens, and dots. Must have at least one dot for TLD
const DOMAIN_REGEX = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

// Custom HTTPS URL schema that:
// - Accepts ONLY URLs with https:// protocol
// - Automatically prefixes https:// to URLs without protocol
// - Rejects ALL other protocols (http://, ftp://, etc.)
// - Requires proper domain with TLD (e.g., example.com, not just "test")
// - Rejects spaces and invalid characters
// - Allows empty strings for optional fields
// - Limits URLs to 150 characters max
export const httpsUrl = z
	.string()
	.max(150, "Website URL must be shorter than 150 characters")
	.refine((val) => val === "" || !val.includes(" "), {
		message: "Website URL cannot contain spaces",
	})
	.transform((val) => {
		// Allow empty strings
		if (val === "") return "";

		const trimmedVal = val.trim();

		// If it doesn't start with any protocol, add https://
		if (!trimmedVal.includes("://")) {
			return `https://${trimmedVal}`;
		}

		return trimmedVal;
	})
	.refine(
		(val) => {
			// Allow empty strings
			if (val === "") return true;

			// Must start with https:// - no other protocols allowed
			if (!val.startsWith("https://")) {
				return false;
			}

			// Extract domain from URL
			try {
				const url = new URL(val);
				// Double-check protocol is https
				if (url.protocol !== "https:") {
					return false;
				}

				// Get hostname and validate it has a proper TLD
				const hostname = url.hostname;

				// Must have at least one dot (domain.tld format)
				if (!DOMAIN_REGEX.test(hostname)) {
					return false;
				}

				return true;
			} catch {
				return false;
			}
		},
		{
			message: "Website must be a valid HTTPS URL with a proper domain (e.g., example.com)",
		},
	);

// Base schemas for type validation and inference
export const baseEventSchema = createSelectSchema(event).extend({
	gearRequirements: z.array(jsonSchema).nullable(),
	mapData: jsonSchema.nullable(),
});
export const baseClubRuleSchema = createSelectSchema(clubRule);
