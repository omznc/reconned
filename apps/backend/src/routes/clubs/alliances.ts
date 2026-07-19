import { apiError, Router, responseSchema } from "@reconned/router";
import { and, eq, inArray } from "drizzle-orm";
import * as z from "zod";
import { alliance, club, clubAlliance, clubMembership } from "../../drizzle/schema";
import { logClubAudit } from "../../lib/audit-logger";
import { db } from "../../lib/db";

const clubsAlliancesRouter = new Router();

const allianceResponseSchema = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string().nullable(),
	countryId: z.number(),
	link: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

clubsAlliancesRouter.put(
	"/clubs/:id/alliances",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select({ role: clubMembership.role })
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		// Get club's country to validate alliances
		const clubData = await db.select({ countryId: club.countryId }).from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		// Validate that all alliance IDs belong to the club's country
		if (body.allianceIds && body.allianceIds.length > 0) {
			const alliances = await db.select().from(alliance).where(inArray(alliance.id, body.allianceIds));

			const invalidAlliances = alliances.filter((a) => a.countryId !== clubData[0]?.countryId);
			if (invalidAlliances.length > 0) {
				throw apiError.validation("All alliances must belong to the club's country");
			}

			if (alliances.length !== body.allianceIds.length) {
				throw apiError.validation("One or more alliance IDs are invalid");
			}
		}

		// Remove existing alliances
		await db.delete(clubAlliance).where(eq(clubAlliance.clubId, clubId));

		// Add new alliances
		if (body.allianceIds && body.allianceIds.length > 0) {
			await db.insert(clubAlliance).values(
				body.allianceIds.map((allianceId) => ({
					clubId,
					allianceId,
				})),
			);
		}

		// Get updated alliances
		const updatedAlliances = await db.query.clubAlliance.findMany({
			where: eq(clubAlliance.clubId, clubId),
			with: {
				alliance: true,
			},
		});

		await logClubAudit({
			clubId,
			actionType: "CLUB_UPDATE",
			actionData: {
				allianceIds: body.allianceIds,
			},
			userId: context.user.id,
		});

		return response.json({ success: true, alliances: updatedAlliances.map((ca) => ca.alliance) });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Update club alliances",
			description: "Update the alliances a club belongs to (requires manager or owner role)",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				allianceIds: z.array(z.number()),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
					alliances: z.array(allianceResponseSchema),
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

clubsAlliancesRouter.get(
	"/clubs/:id/alliances",
	async ({ params, response }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const clubAlliances = await db.query.clubAlliance.findMany({
			where: eq(clubAlliance.clubId, clubId),
			with: {
				alliance: {
					with: {
						country: true,
					},
				},
			},
		});

		return response.json({ alliances: clubAlliances.map((ca) => ca.alliance) });
	},
	{
		schema: {
			tags: ["Clubs"],
			summary: "Get club alliances",
			description: "Get all alliances a club belongs to",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					alliances: z.array(allianceResponseSchema),
				}),
				...responseSchema([400, 404], z.object({ error: z.string() })),
			},
		},
	},
);

export { clubsAlliancesRouter };
