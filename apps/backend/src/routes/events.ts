import { randomUUIDv7 } from "bun";
import { and, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { club, clubMembership, clubRule, event, eventRegistration } from "../drizzle/schema";
import { logClubAudit } from "../lib/audit-logger";
import { db } from "../lib/db";
import { Router, responseSchema } from "../lib/router";
import { paginationQuerySchema, paginationResponseSchema } from "../lib/schemas";
import { deleteS3Files } from "../lib/storage";

const eventsRouter = new Router();

const baseEventSchema = createSelectSchema(event);

eventsRouter.get(
	"/api/events",
	async ({ query, context, validatedQuery, response }) => {
		const { page, perPage } = validatedQuery || {
			page: Number.parseInt(query.get("page") || "1", 10),
			perPage: Number.parseInt(query.get("perPage") || "25", 10),
		};
		const offset = (page - 1) * perPage;
		const search = query.get("search") || "";
		const sortBy = query.get("sortBy") || "dateStart";
		const sortOrder = query.get("sortOrder") || "asc";
		const isPrivateFilter = query.get("isPrivate");

		const whereConditions = [];

		if (search) {
			whereConditions.push(or(ilike(event.name, `%${search}%`), ilike(event.location, `%${search}%`)));
		}

		if (isPrivateFilter !== null && isPrivateFilter !== undefined) {
			whereConditions.push(eq(event.isPrivate, isPrivateFilter === "true"));
		} else if (!context.user) {
			whereConditions.push(eq(event.isPrivate, false));
		} else {
			const userClubMemberships = await db
				.select({ clubId: clubMembership.clubId })
				.from(clubMembership)
				.where(eq(clubMembership.userId, context.user.id));

			const userClubIds = userClubMemberships.map((m) => m.clubId);

			if (userClubIds.length > 0) {
				const privacyCondition = or(eq(event.isPrivate, false), sql`${event.clubId} = ANY(${userClubIds})`);
				if (privacyCondition) {
					whereConditions.push(privacyCondition);
				}
			} else {
				whereConditions.push(eq(event.isPrivate, false));
			}
		}

		const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		let orderByClause: typeof event.dateStart | typeof event.name | ReturnType<typeof desc>;
		if (sortBy === "name") {
			orderByClause = sortOrder === "asc" ? event.name : desc(event.name);
		} else {
			orderByClause = sortOrder === "asc" ? event.dateStart : desc(event.dateStart);
		}

		const events = await db
			.select()
			.from(event)
			.where(whereClause)
			.orderBy(orderByClause)
			.limit(perPage)
			.offset(offset);

		const totalData = await db.select({ count: count() }).from(event).where(whereClause);
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
		schema: {
			tags: ["Events"],
			summary: "List events",
			description: "List events with pagination, search, sorting, and privacy filtering",
			query: paginationQuerySchema.extend({
				search: z.string().optional(),
				sortBy: z.enum(["name", "dateStart"]).optional(),
				sortOrder: z.enum(["asc", "desc"]).optional(),
				isPrivate: z.string().optional(),
			}),
			response: {
				200: z.object({
					events: z.array(baseEventSchema),
					pagination: paginationResponseSchema,
				}),
			},
		},
	},
);

eventsRouter.get(
	"/api/events/:id",
	async ({ params, context, response }) => {
		const eventId = params.id;

		if (!eventId) {
			return response.error({ error: "Event ID is required" }, 400);
		}

		const eventData = await db
			.select()
			.from(event)
			.where(or(eq(event.id, eventId), eq(event.slug, eventId)))
			.limit(1);

		if (!eventData[0]) {
			return response.error({ error: "Event not found" }, 404);
		}

		const eventRecord = eventData[0];

		if (eventRecord.isPrivate && context.user) {
			const userMembership = await db
				.select()
				.from(clubMembership)
				.where(and(eq(clubMembership.clubId, eventRecord.clubId), eq(clubMembership.userId, context.user.id)))
				.limit(1);

			if (!userMembership[0]) {
				return response.error({ error: "Event not found" }, 404);
			}
		} else if (eventRecord.isPrivate && !context.user) {
			return response.error({ error: "Event not found" }, 404);
		}

		const registrationCount = await db
			.select({ count: count() })
			.from(eventRegistration)
			.where(eq(eventRegistration.eventId, eventRecord.id));

		const clubData = await db.select().from(club).where(eq(club.id, eventRecord.clubId)).limit(1);

		return response.json({
			event: eventRecord,
			club: clubData[0],
			registrationCount: Number(registrationCount[0]?.count || 0),
		});
	},
	{
		schema: {
			tags: ["Events"],
			summary: "Get event by ID or slug",
			description: "Get event details by ID or slug with club info and registration count",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					event: baseEventSchema,
					club: z.any(),
					registrationCount: z.number(),
				}),
				400: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

eventsRouter.get(
	"/api/events/upcoming",
	async ({ query, context, response }) => {
		const limit = Number.parseInt(query.get("limit") || "100", 10);

		const whereConditions = [gte(event.dateStart, new Date().toISOString())];

		if (!context.user) {
			whereConditions.push(eq(event.isPrivate, false));
		} else {
			const userClubMemberships = await db
				.select({ clubId: clubMembership.clubId })
				.from(clubMembership)
				.where(eq(clubMembership.userId, context.user.id));

			const userClubIds = userClubMemberships.map((m) => m.clubId);

			if (userClubIds.length > 0) {
				const privacyCondition = or(eq(event.isPrivate, false), sql`${event.clubId} = ANY(${userClubIds})`);
				if (privacyCondition) {
					whereConditions.push(privacyCondition);
				}
			} else {
				whereConditions.push(eq(event.isPrivate, false));
			}
		}

		const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		const events = whereClause
			? await db.select().from(event).where(whereClause).orderBy(event.dateStart).limit(limit)
			: await db.select().from(event).orderBy(event.dateStart).limit(limit);

		return response.json({ events });
	},
	{
		schema: {
			tags: ["Events"],
			summary: "Get upcoming events",
			description: "Get upcoming events with privacy filtering",
			query: z.object({
				limit: z.string().optional(),
			}),
			response: {
				200: z.object({
					events: z.array(baseEventSchema),
				}),
			},
		},
	},
);

eventsRouter.get(
	"/api/events/calendar",
	async ({ query, context, response }) => {
		const startDate = query.get("startDate");
		const endDate = query.get("endDate");

		if (!startDate || !endDate) {
			return response.error({ error: "Start date and end date are required" }, 400);
		}

		const whereConditions = [gte(event.dateStart, startDate), lte(event.dateStart, endDate)];

		if (!context.user) {
			whereConditions.push(eq(event.isPrivate, false));
		} else {
			const userClubMemberships = await db
				.select({ clubId: clubMembership.clubId })
				.from(clubMembership)
				.where(eq(clubMembership.userId, context.user.id));

			const userClubIds = userClubMemberships.map((m) => m.clubId);

			if (userClubIds.length > 0) {
				const privacyCondition = or(eq(event.isPrivate, false), sql`${event.clubId} = ANY(${userClubIds})`);
				if (privacyCondition) {
					whereConditions.push(privacyCondition);
				}
			} else {
				whereConditions.push(eq(event.isPrivate, false));
			}
		}

		const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		const events = await db.select().from(event).where(whereClause).orderBy(event.dateStart);

		return response.json({ events });
	},
	{
		schema: {
			tags: ["Events"],
			summary: "Get events for calendar view",
			description: "Get events within a date range for calendar display",
			query: z.object({
				startDate: z.string(),
				endDate: z.string(),
			}),
			response: {
				200: z.object({
					events: z.array(baseEventSchema),
				}),
				400: z.object({ error: z.string() }),
			},
		},
	},
);

eventsRouter.get(
	"/api/events/count",
	async ({ query, context, response }) => {
		const isPrivateFilter = query.get("isPrivate");

		const whereConditions = [];

		if (isPrivateFilter !== null && isPrivateFilter !== undefined) {
			whereConditions.push(eq(event.isPrivate, isPrivateFilter === "true"));
		} else if (!context.user) {
			whereConditions.push(eq(event.isPrivate, false));
		} else {
			const userClubMemberships = await db
				.select({ clubId: clubMembership.clubId })
				.from(clubMembership)
				.where(eq(clubMembership.userId, context.user.id));

			const userClubIds = userClubMemberships.map((m) => m.clubId);

			if (userClubIds.length > 0) {
				const privacyCondition = or(eq(event.isPrivate, false), sql`${event.clubId} = ANY(${userClubIds})`);
				if (privacyCondition) {
					whereConditions.push(privacyCondition);
				}
			} else {
				whereConditions.push(eq(event.isPrivate, false));
			}
		}

		const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		const totalData = whereClause
			? await db.select({ count: count() }).from(event).where(whereClause)
			: await db.select({ count: count() }).from(event);
		const total = totalData[0]?.count || 0;

		return response.json({ count: total });
	},
	{
		schema: {
			tags: ["Events"],
			summary: "Count events",
			description: "Count events with optional privacy filtering",
			query: z.object({
				isPrivate: z.string().optional(),
			}),
			response: {
				200: z.object({
					count: z.number(),
				}),
			},
		},
	},
);

async function validateEventSlug(slug: string, excludeEventId?: string): Promise<boolean> {
	const [eventBySlug, eventById] = await Promise.all([
		db.select().from(event).where(eq(event.slug, slug)).limit(1),
		db.select().from(event).where(eq(event.id, slug)).limit(1),
	]);

	if (excludeEventId) {
		return !eventBySlug[0] && !eventById[0] && slug !== excludeEventId;
	}

	return !eventBySlug[0] && !eventById[0];
}

eventsRouter.post(
	"/api/events",
	async ({ context, validatedBody, response }) => {
		if (!context.user) {
			return response.error({ error: "Unauthorized" }, 401);
		}

		const body = validatedBody as {
			clubId: string;
			name: string;
			description: string;
			costPerPerson: number;
			location: string;
			googleMapsLink?: string;
			dateStart: string;
			dateEnd: string;
			dateRegistrationsOpen: string;
			dateRegistrationsClose: string;
			slug?: string;
			image?: string;
			isPrivate?: boolean;
			allowFreelancers?: boolean;
			hasBreakfast?: boolean;
			hasLunch?: boolean;
			hasDinner?: boolean;
			hasSnacks?: boolean;
			hasDrinks?: boolean;
			hasPrizes?: boolean;
			ruleIds?: string[];
			mapData?: unknown;
		};

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, body.clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			return response.error({ error: "Unauthorized - must be manager or owner" }, 403);
		}

		if (body.slug) {
			const valid = await validateEventSlug(body.slug);
			if (!valid) {
				return response.error({ error: "This slug is already taken" }, 400);
			}
		}

		const eventId = randomUUIDv7();

		const newEvent = await db
			.insert(event)
			.values({
				id: eventId,
				clubId: body.clubId,
				name: body.name,
				description: body.description,
				costPerPerson: body.costPerPerson,
				location: body.location,
				googleMapsLink: body.googleMapsLink || null,
				dateStart: body.dateStart,
				dateEnd: body.dateEnd,
				dateRegistrationsOpen: body.dateRegistrationsOpen,
				dateRegistrationsClose: body.dateRegistrationsClose,
				slug: body.slug || null,
				image: body.image || null,
				isPrivate: body.isPrivate || false,
				allowFreelancers: body.allowFreelancers || false,
				hasBreakfast: body.hasBreakfast || false,
				hasLunch: body.hasLunch || false,
				hasDinner: body.hasDinner || false,
				hasSnacks: body.hasSnacks || false,
				hasDrinks: body.hasDrinks || false,
				hasPrizes: body.hasPrizes || false,
				mapData: body.mapData ? (body.mapData as Record<string, unknown>) : null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.returning();

		if (body.ruleIds && body.ruleIds.length > 0) {
			await db
				.update(clubRule)
				.set({ eventId })
				.where(and(eq(clubRule.clubId, body.clubId), sql`${clubRule.id} = ANY(${body.ruleIds})`));
		}

		await logClubAudit({
			clubId: body.clubId,
			actionType: "EVENT_CREATE",
			actionData: {
				id: eventId,
				name: body.name,
				description: body.description,
				costPerPerson: body.costPerPerson,
				location: body.location,
				dateStart: body.dateStart,
				dateEnd: body.dateEnd,
			},
			userId: context.user.id,
		});

		return response.json({ success: true, event: newEvent[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Events"],
			summary: "Create event",
			description: "Create a new event",
			body: z.object({
				clubId: z.string(),
				name: z.string().min(1),
				description: z.string().min(1),
				costPerPerson: z.number().gte(0).lte(300),
				location: z.string().min(1),
				googleMapsLink: z.string().optional(),
				dateStart: z.string(),
				dateEnd: z.string(),
				dateRegistrationsOpen: z.string(),
				dateRegistrationsClose: z.string(),
				slug: z.string().optional(),
				image: z.string().optional(),
				isPrivate: z.boolean().optional(),
				allowFreelancers: z.boolean().optional(),
				hasBreakfast: z.boolean().optional(),
				hasLunch: z.boolean().optional(),
				hasDinner: z.boolean().optional(),
				hasSnacks: z.boolean().optional(),
				hasDrinks: z.boolean().optional(),
				hasPrizes: z.boolean().optional(),
				ruleIds: z.array(z.string()).optional(),
				mapData: z.any().optional(),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
					event: baseEventSchema,
				}),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

eventsRouter.put(
	"/api/events/:id",
	async ({ params, context, validatedBody, response }) => {
		const eventId = params.id;

		if (!eventId) {
			return response.error({ error: "Event ID is required" }, 400);
		}

		if (!context.user) {
			return response.error({ error: "Unauthorized" }, 401);
		}

		const body = validatedBody as {
			clubId: string;
			name: string;
			description: string;
			costPerPerson: number;
			location: string;
			googleMapsLink?: string;
			dateStart: string;
			dateEnd: string;
			dateRegistrationsOpen: string;
			dateRegistrationsClose: string;
			slug?: string;
			image?: string;
			isPrivate?: boolean;
			allowFreelancers?: boolean;
			hasBreakfast?: boolean;
			hasLunch?: boolean;
			hasDinner?: boolean;
			hasSnacks?: boolean;
			hasDrinks?: boolean;
			hasPrizes?: boolean;
			ruleIds?: string[];
			mapData?: unknown;
		};

		const existingEventData = await db.select().from(event).where(eq(event.id, eventId)).limit(1);

		if (!existingEventData[0]) {
			return response.error({ error: "Event not found" }, 404);
		}

		const existingEvent = existingEventData[0];

		if (new Date(existingEvent.dateEnd) <= new Date()) {
			return response.error({ error: "You cannot update a finished event" }, 400);
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, existingEvent.clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			return response.error({ error: "Unauthorized - must be manager or owner" }, 403);
		}

		if (body.slug && body.slug !== existingEvent.slug) {
			const valid = await validateEventSlug(body.slug, eventId);
			if (!valid) {
				return response.error({ error: "This slug is already taken" }, 400);
			}
		}

		const updatedEvent = await db
			.update(event)
			.set({
				name: body.name,
				description: body.description,
				costPerPerson: body.costPerPerson,
				location: body.location,
				googleMapsLink: body.googleMapsLink || null,
				dateStart: body.dateStart,
				dateEnd: body.dateEnd,
				dateRegistrationsOpen: body.dateRegistrationsOpen,
				dateRegistrationsClose: body.dateRegistrationsClose,
				slug: body.slug || null,
				image: body.image !== undefined ? body.image || null : existingEvent.image,
				isPrivate: body.isPrivate !== undefined ? body.isPrivate : existingEvent.isPrivate,
				allowFreelancers:
					body.allowFreelancers !== undefined ? body.allowFreelancers : existingEvent.allowFreelancers,
				hasBreakfast: body.hasBreakfast !== undefined ? body.hasBreakfast : existingEvent.hasBreakfast,
				hasLunch: body.hasLunch !== undefined ? body.hasLunch : existingEvent.hasLunch,
				hasDinner: body.hasDinner !== undefined ? body.hasDinner : existingEvent.hasDinner,
				hasSnacks: body.hasSnacks !== undefined ? body.hasSnacks : existingEvent.hasSnacks,
				hasDrinks: body.hasDrinks !== undefined ? body.hasDrinks : existingEvent.hasDrinks,
				hasPrizes: body.hasPrizes !== undefined ? body.hasPrizes : existingEvent.hasPrizes,
				mapData: body.mapData ? (body.mapData as Record<string, unknown>) : existingEvent.mapData,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(event.id, eventId))
			.returning();

		if (body.ruleIds) {
			await db.update(clubRule).set({ eventId: null }).where(eq(clubRule.eventId, eventId));

			if (body.ruleIds.length > 0) {
				await db
					.update(clubRule)
					.set({ eventId })
					.where(and(eq(clubRule.clubId, existingEvent.clubId), sql`${clubRule.id} = ANY(${body.ruleIds})`));
			}
		}

		await logClubAudit({
			clubId: existingEvent.clubId,
			actionType: "EVENT_UPDATE",
			actionData: {
				id: eventId,
				name: body.name,
				description: body.description,
			},
			userId: context.user.id,
		});

		return response.json({ success: true, event: updatedEvent[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Events"],
			summary: "Update event",
			description: "Update an existing event",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				clubId: z.string(),
				name: z.string().min(1),
				description: z.string().min(1),
				costPerPerson: z.number().gte(0).lte(300),
				location: z.string().min(1),
				googleMapsLink: z.string().optional(),
				dateStart: z.string(),
				dateEnd: z.string(),
				dateRegistrationsOpen: z.string(),
				dateRegistrationsClose: z.string(),
				slug: z.string().optional(),
				image: z.string().optional(),
				isPrivate: z.boolean().optional(),
				allowFreelancers: z.boolean().optional(),
				hasBreakfast: z.boolean().optional(),
				hasLunch: z.boolean().optional(),
				hasDinner: z.boolean().optional(),
				hasSnacks: z.boolean().optional(),
				hasDrinks: z.boolean().optional(),
				hasPrizes: z.boolean().optional(),
				ruleIds: z.array(z.string()).optional(),
				mapData: z.any().optional(),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
					event: baseEventSchema,
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

eventsRouter.delete(
	"/api/events/:id",
	async ({ params, context, response }) => {
		const eventId = params.id;

		if (!eventId) {
			return response.error({ error: "Event ID is required" }, 400);
		}

		if (!context.user) {
			return response.error({ error: "Unauthorized" }, 401);
		}

		const existingEventData = await db.select().from(event).where(eq(event.id, eventId)).limit(1);

		if (!existingEventData[0]) {
			return response.error({ error: "Event not found" }, 404);
		}

		const existingEvent = existingEventData[0];

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, existingEvent.clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			return response.error({ error: "Unauthorized - must be manager or owner" }, 403);
		}

		if (existingEvent.image) {
			const imageKey = existingEvent.image.split("/").pop() || "";
			if (imageKey) {
				await deleteS3Files([imageKey]);
			}
		}

		await db.delete(event).where(eq(event.id, eventId));

		await logClubAudit({
			clubId: existingEvent.clubId,
			actionType: "EVENT_DELETE",
			actionData: {
				id: eventId,
				name: existingEvent.name,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Events"],
			summary: "Delete event",
			description: "Delete an event",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

export { eventsRouter };
