import { apiError, Router, responseSchema } from "@reconned/router";
import { and, count, desc, eq, ilike, inArray } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { clubMembership, event, eventRegistration } from "../../drizzle/schema";
import { db } from "../../lib/db";
import { paginationQuerySchema, paginationResponseSchema } from "../../lib/schemas";

const clubsEventsRouter = new Router();

const baseEventSchema = createSelectSchema(event);

clubsEventsRouter.get(
	"/clubs/:clubId/events",
	async ({ params, response, context, query }) => {
		const clubId = params.clubId;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		// A club's event list is public: anyone, signed in or not, may browse it. Managers and
		// owners additionally see the club's private events, so the only thing the membership
		// lookup decides is whether `isPrivate` rows are included — it is not an access gate.
		const isManager = await (async () => {
			if (!context.user) {
				return false;
			}

			const membershipData = await db
				.select({ role: clubMembership.role })
				.from(clubMembership)
				.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
				.limit(1);

			const role = membershipData[0]?.role;
			return role === "MANAGER" || role === "CLUB_OWNER";
		})();

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;
		const search = query?.search || "";
		const sortBy = query?.sortBy || "dateStart";
		const sortOrder = query?.sortOrder || "desc";

		const whereConditions = [eq(event.clubId, clubId)];

		if (!isManager) {
			whereConditions.push(eq(event.isPrivate, false));
		}

		if (search) {
			whereConditions.push(ilike(event.name, `%${search}%`));
		}

		const whereClause = and(...whereConditions);

		let orderByClause: typeof event.dateStart | typeof event.name | ReturnType<typeof desc>;
		if (sortBy === "name") {
			orderByClause = sortOrder === "asc" ? event.name : desc(event.name);
		} else {
			orderByClause = sortOrder === "asc" ? event.dateStart : desc(event.dateStart);
		}

		const eventsData = await db
			.select()
			.from(event)
			.where(whereClause)
			.orderBy(orderByClause)
			.limit(perPage)
			.offset(offset);

		// Batch the registration counts into a single grouped query instead of one
		// count() per event.
		const pageEventIds = eventsData.map((e) => e.id);
		const [registrationCounts, totalData] = await Promise.all([
			pageEventIds.length
				? db
						.select({
							eventId: eventRegistration.eventId,
							count: count(),
						})
						.from(eventRegistration)
						.where(inArray(eventRegistration.eventId, pageEventIds))
						.groupBy(eventRegistration.eventId)
				: Promise.resolve([]),
			db.select({ count: count() }).from(event).where(whereClause),
		]);

		const registrationCountByEventId = new Map(registrationCounts.map((rc) => [rc.eventId, Number(rc.count)]));

		const events = eventsData.map((e) => ({
			...e,
			gearRequirements: e.gearRequirements as z.infer<typeof baseEventSchema>["gearRequirements"],
			mapData: e.mapData as z.infer<typeof baseEventSchema>["mapData"],
			_count: {
				eventRegistration: registrationCountByEventId.get(e.id) || 0,
			},
		}));

		const total = totalData[0]?.count || 0;

		return response.json({
			events,
			pagination: {
				page,
				perPage,
				total,
				totalPages: Math.ceil(total / perPage),
			},
		});
	},
	{
		// Public: a club's event list is browsable by signed-out visitors too. The handler treats
		// `context.user` as optional and uses it only to decide whether private events are included.
		schema: {
			tags: ["Clubs"],
			summary: "Get club events",
			description: "Get events for a specific club with pagination, search, and sorting",
			params: z.object({
				clubId: z.string(),
			}),
			query: paginationQuerySchema.extend({
				search: z.string().max(100).optional(),
				sortBy: z.enum(["name", "dateStart"]).optional(),
				sortOrder: z.enum(["asc", "desc"]).optional(),
			}),
			response: {
				200: z.object({
					events: z.array(
						baseEventSchema.extend({
							_count: z.object({
								eventRegistration: z.number(),
							}),
						}),
					),
					pagination: paginationResponseSchema,
				}),
				// No 401/403: the route is public and the handler has no authorization branch that
				// can reject a caller.
				...responseSchema([400], z.object({ error: z.string() })),
			},
		},
	},
);

clubsEventsRouter.get(
	"/clubs/:clubId/events/count",
	async ({ params, response, query, context }) => {
		const clubId = params.clubId;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		// Mirrors the visibility rule in `GET /clubs/:clubId/events` above — the count has to be
		// taken over exactly the same row set the list returns, or pagination breaks for anyone
		// who cannot see the club's private events.
		const isManager = await (async () => {
			if (!context.user) {
				return false;
			}

			const membershipData = await db
				.select({ role: clubMembership.role })
				.from(clubMembership)
				.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
				.limit(1);

			const role = membershipData[0]?.role;
			return role === "MANAGER" || role === "CLUB_OWNER";
		})();

		const search = query?.search || "";

		const whereConditions = [eq(event.clubId, clubId)];

		if (!isManager) {
			whereConditions.push(eq(event.isPrivate, false));
		}

		if (search) {
			whereConditions.push(ilike(event.name, `%${search}%`));
		}

		const whereClause = and(...whereConditions);

		const totalData = await db.select({ count: count() }).from(event).where(whereClause);
		const total = totalData[0]?.count || 0;

		return response.json({ count: total });
	},
	{
		// Public, for the same reason as `GET /clubs/:clubId/events` above.
		schema: {
			tags: ["Clubs"],
			summary: "Count club events",
			description: "Count events for a specific club with optional search filter",
			params: z.object({
				clubId: z.string(),
			}),
			query: z.object({
				search: z.string().max(100).optional(),
			}),
			response: {
				200: z.object({
					count: z.number(),
				}),
				...responseSchema([400], z.object({ error: z.string() })),
			},
		},
	},
);

export { clubsEventsRouter };
