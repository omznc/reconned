import { asc, eq } from "drizzle-orm";
import * as z from "zod";
import { alliance } from "../drizzle/schema";
import { db } from "../lib/db";
import { apiError } from "../lib/errors";
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
	async ({ params, response }) => {
		const countryId = Number(params.countryId);

		if (!countryId || Number.isNaN(countryId)) {
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
