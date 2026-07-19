import { apiError, Router, responseSchema } from "@reconned/router";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import * as z from "zod";
import { club, clubMembership, clubPurchase, event, eventRegistration, post } from "../../drizzle/schema";
import { db } from "../../lib/db";
import { extractSizeFromKey } from "../../lib/storage";

const clubsStatsRouter = new Router();

clubsStatsRouter.get(
	"/clubs/:id/stats",
	async ({ params, response, context }) => {
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

		const clubData = await db.select({ createdAt: club.createdAt }).from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		const clubCreatedAt = clubData[0].createdAt;

		// All four queries below are independent - run them concurrently.
		const [membersOverTime, roleDistribution, eventsPerMonth, recentEventsData] = await Promise.all([
			// Cumulative members per day. Aggregates memberships once (O(members)) and then
			// runs a window function over the day series, instead of the old recursive CTE
			// that LEFT JOINed every membership against every day (O(days * members)).
			db.execute<{ date: Date | string; count: number | string }>(sql`
				WITH daily AS (
					SELECT DATE_TRUNC('day', cm."createdAt")::date AS day, COUNT(*)::int AS added
					FROM "ClubMembership" cm
					WHERE cm."clubId" = ${clubId}
					GROUP BY 1
				)
				SELECT
					d.day::date::text AS date,
					COALESCE(SUM(daily.added) OVER (ORDER BY d.day), 0)::int AS count
				FROM generate_series(
					DATE_TRUNC('day', ${clubCreatedAt}::timestamp)::date,
					CURRENT_DATE,
					INTERVAL '1 day'
				) AS d(day)
				LEFT JOIN daily ON daily.day = d.day::date
				ORDER BY d.day ASC
			`),
			db
				.select({
					role: clubMembership.role,
					count: count(),
				})
				.from(clubMembership)
				.where(eq(clubMembership.clubId, clubId))
				.groupBy(clubMembership.role),
			// Events per month for the last 12 months. The range predicate on "dateStart" is
			// sargable, so this can use Event_clubId_dateStart_idx - unlike the previous
			// DATE_TRUNC('month', e."dateStart") = m.month join condition.
			db.execute<{ month: Date | string; count: number | string }>(sql`
				WITH monthly AS (
					SELECT DATE_TRUNC('month', e."dateStart")::date AS month, COUNT(*)::int AS cnt
					FROM "Event" e
					WHERE e."clubId" = ${clubId}
						AND e."dateStart" >= DATE_TRUNC('month', NOW() - INTERVAL '11 months')
					GROUP BY 1
				)
				SELECT
					m.month::date::text AS month,
					COALESCE(monthly.cnt, 0)::int AS count
				FROM generate_series(
					DATE_TRUNC('month', NOW() - INTERVAL '11 months')::date,
					DATE_TRUNC('month', NOW())::date,
					INTERVAL '1 month'
				) AS m(month)
				LEFT JOIN monthly ON monthly.month = m.month::date
				ORDER BY m.month ASC
			`),
			db
				.select({
					id: event.id,
					name: event.name,
					dateStart: event.dateStart,
				})
				.from(event)
				.where(eq(event.clubId, clubId))
				.orderBy(desc(event.dateStart))
				.limit(10),
		]);

		// Get registration counts for all recent events in a single query
		const eventIds = recentEventsData.map((e) => e.id);
		const registrationCounts = eventIds.length
			? await db
					.select({
						eventId: eventRegistration.eventId,
						count: count(),
					})
					.from(eventRegistration)
					.where(inArray(eventRegistration.eventId, eventIds))
					.groupBy(eventRegistration.eventId)
			: [];

		// Create a map for quick lookup
		const registrationCountMap = new Map(registrationCounts.map((rc) => [rc.eventId, Number(rc.count)]));

		const recentEvents = recentEventsData.map((e) => ({
			id: e.id,
			name: e.name,
			dateStart: e.dateStart,
			registrationCount: registrationCountMap.get(e.id) || 0,
		}));

		return response.json({
			members: membersOverTime.map((row) => ({
				date: row.date instanceof Date ? row.date.toISOString() : String(row.date),
				count: Number(row.count),
			})),
			roles: roleDistribution.map((r) => ({
				role: r.role,
				count: Number(r.count),
			})),
			events: eventsPerMonth.map((row) => ({
				month: row.month instanceof Date ? row.month.toISOString() : String(row.month),
				count: Number(row.count),
			})),
			recentEvents,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club statistics",
			description:
				"Get club statistics including members over time, role distribution, events per month, and recent events",
			params: z.object({
				id: z.string(),
			}),
			mcpTool: true,
			response: {
				200: z.object({
					members: z.array(
						z.object({
							date: z.string(),
							count: z.number(),
						}),
					),
					roles: z.array(
						z.object({
							role: z.string(),
							count: z.number(),
						}),
					),
					events: z.array(
						z.object({
							month: z.string(),
							count: z.number(),
						}),
					),
					recentEvents: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							dateStart: z.string(),
							registrationCount: z.number(),
						}),
					),
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
		// Stats are manager-only and club-scoped, so the cache must vary by user.
		cache: {
			key: "club:{id}:stats",
			ttl: 300,
			swr: 1800,
			// Manager-only data; keep per-user entries so a non-manager can never read a warm entry.
			varyByUser: true,
		},
	},
);

clubsStatsRouter.get(
	"/clubs/:id/storage-quota",
	async ({ params, response, context }) => {
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

		const [postsUsage, receiptsUsage] = await Promise.all([
			db.select({ images: post.images }).from(post).where(eq(post.clubId, clubId)),
			db
				.select({ receiptUrls: clubPurchase.receiptUrls })
				.from(clubPurchase)
				.where(eq(clubPurchase.clubId, clubId)),
		]);

		const postImageSizes = postsUsage.flatMap((p) =>
			(p.images as string[]).map((imageKey) => extractSizeFromKey(imageKey)),
		);

		const receiptSizes = receiptsUsage.flatMap((purchase) =>
			(purchase.receiptUrls as string[]).map((receiptKey) => extractSizeFromKey(receiptKey)),
		);

		const CLUB_TOTAL_LIMIT = 1024 * 1024 * 1024;
		const currentUsage = [...postImageSizes, ...receiptSizes].reduce((total, size) => total + size, 0);
		const remaining = Math.max(0, CLUB_TOTAL_LIMIT - currentUsage);

		return response.json({
			currentUsage,
			limit: CLUB_TOTAL_LIMIT,
			remaining,
			allowed: currentUsage < CLUB_TOTAL_LIMIT,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club storage quota",
			description: "Check club storage quota usage from posts and purchases",
			params: z.object({
				id: z.string(),
			}),
			mcpTool: true,
			response: {
				200: z.object({
					currentUsage: z.number(),
					limit: z.number(),
					remaining: z.number(),
					allowed: z.boolean(),
				}),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

export { clubsStatsRouter };
