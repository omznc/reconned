import { asc, eq } from "drizzle-orm";
import * as z from "zod";
import { alliance } from "../drizzle/schema";
import { db } from "../lib/db";
import { apiError } from "../lib/errors";
import { logger } from "../lib/posthog";
import { Router, responseSchema } from "../lib/router";

const allianceSchema = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string().nullable(),
	countryId: z.number(),
});

export const alliancesRouter = new Router();

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
