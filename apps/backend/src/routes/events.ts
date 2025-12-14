import { randomUUIDv7 } from "bun";
import { and, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
	club,
	clubMembership,
	clubRule,
	event,
	eventInvite,
	eventRegistration,
	eventRegistrationToUser,
} from "../drizzle/schema";
import { logClubAudit } from "../lib/audit-logger";
import { db } from "../lib/db";
import { Router, responseSchema } from "../lib/router";
import { paginationQuerySchema, paginationResponseSchema } from "../lib/schemas";
import { deleteS3Files, getS3UploadUrl } from "../lib/storage";

const eventsRouter = new Router();

const baseEventSchema = createSelectSchema(event);
const baseClubRuleSchema = createSelectSchema(clubRule);

eventsRouter.get(
	"/api/events",
	async ({ context, query, response }) => {
		const { page, perPage } = query;
		const offset = (page - 1) * perPage;
		const search = query?.search || "";
		const sortBy = query?.sortBy || "dateStart";
		const sortOrder = query?.sortOrder || "asc";
		const isPrivateFilter = query?.isPrivate;

		const whereConditions = [];

		if (search) {
			const searchCondition = or(ilike(event.name, `%${search}%`), ilike(event.location, `%${search}%`));
			if (searchCondition) {
				whereConditions.push(searchCondition);
			}
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
			events: events.map((e) => ({
				...e,
				gearRequirements: e.gearRequirements as z.infer<typeof baseEventSchema>["gearRequirements"],
				mapData: e.mapData as z.infer<typeof baseEventSchema>["mapData"],
			})),
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
	"/api/events/upcoming",
	async ({ query, context, response }) => {
		const limit = query.limit ?? 25;

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

		const eventsWithClubs = await Promise.all(
			events.map(async (e) => {
				const clubData = await db
					.select({ name: club.name, verified: club.verified })
					.from(club)
					.where(eq(club.id, e.clubId))
					.limit(1);

				return {
					...e,
					gearRequirements: e.gearRequirements as z.infer<typeof baseEventSchema>["gearRequirements"],
					mapData: e.mapData as z.infer<typeof baseEventSchema>["mapData"],
					club: clubData[0] || null,
				};
			}),
		);

		return response.json({
			events: eventsWithClubs,
		});
	},
	{
		schema: {
			tags: ["Events"],
			summary: "Get upcoming events",
			description: "Get upcoming events with privacy filtering",
			query: z.object({
				limit: z.coerce.number().optional().default(25),
			}),
			response: {
				200: z.object({
					events: z.array(
						baseEventSchema.extend({
							club: z
								.object({
									name: z.string(),
									verified: z.boolean(),
								})
								.nullable(),
						}),
					),
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
			event: {
				...eventRecord,
				gearRequirements: eventRecord.gearRequirements as z.infer<typeof baseEventSchema>["gearRequirements"],
				mapData: eventRecord.mapData as z.infer<typeof baseEventSchema>["mapData"],
			},
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
		const limit = query.limit ?? 25;

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

		const eventsWithClubs = await Promise.all(
			events.map(async (e) => {
				const clubData = await db
					.select({ name: club.name, verified: club.verified })
					.from(club)
					.where(eq(club.id, e.clubId))
					.limit(1);

				return {
					...e,
					gearRequirements: e.gearRequirements as z.infer<typeof baseEventSchema>["gearRequirements"],
					mapData: e.mapData as z.infer<typeof baseEventSchema>["mapData"],
					club: clubData[0] || null,
				};
			}),
		);

		return response.json({
			events: eventsWithClubs,
		});
	},
	{
		schema: {
			tags: ["Events"],
			summary: "Get upcoming events",
			description: "Get upcoming events with privacy filtering",
			query: z.object({
				limit: z.coerce.number().optional().default(25),
			}),
			response: {
				200: z.object({
					events: z.array(
						baseEventSchema.extend({
							club: z
								.object({
									name: z.string(),
									verified: z.boolean(),
								})
								.nullable(),
						}),
					),
				}),
			},
		},
	},
);

eventsRouter.get(
	"/api/events/calendar",
	async ({ query, context, response }) => {
		const startDate = query?.startDate;
		const endDate = query?.endDate;

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

		const eventsWithClubs = await Promise.all(
			events.map(async (e) => {
				const clubData = await db
					.select({ name: club.name, verified: club.verified })
					.from(club)
					.where(eq(club.id, e.clubId))
					.limit(1);

				return {
					...e,
					gearRequirements: e.gearRequirements as z.infer<typeof baseEventSchema>["gearRequirements"],
					mapData: e.mapData as z.infer<typeof baseEventSchema>["mapData"],
					club: clubData[0] || null,
				};
			}),
		);

		return response.json({
			events: eventsWithClubs,
		});
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
		const isPrivateFilter = query?.isPrivate;

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
	async ({ context, body, response }) => {
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

		if (!newEvent[0]) {
			return response.error({ error: "Failed to create event" }, 500);
		}

		return response.json({
			success: true,
			event: {
				...newEvent[0],
				gearRequirements: newEvent[0].gearRequirements as z.infer<typeof baseEventSchema>["gearRequirements"],
				mapData: newEvent[0].mapData as z.infer<typeof baseEventSchema>["mapData"],
			},
		});
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
	async ({ params, context, body, response }) => {
		const eventId = params.id;

		if (!eventId) {
			return response.error({ error: "Event ID is required" }, 400);
		}

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

		if (!updatedEvent[0]) {
			return response.error({ error: "Failed to update event" }, 500);
		}

		return response.json({
			success: true,
			event: {
				...updatedEvent[0],
				gearRequirements: updatedEvent[0].gearRequirements as z.infer<
					typeof baseEventSchema
				>["gearRequirements"],
				mapData: updatedEvent[0].mapData as z.infer<typeof baseEventSchema>["mapData"],
			},
		});
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

eventsRouter.get(
	"/api/clubs/:clubId/events",
	async ({ params, query, response }) => {
		const clubId = params.clubId;

		if (!clubId) {
			return response.error({ error: "Club ID is required" }, 400);
		}

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;
		const search = query?.search || "";
		const sortBy = query?.sortBy || "dateStart";
		const sortOrder = query?.sortOrder || "desc";

		const whereConditions = [eq(event.clubId, clubId)];

		if (search) {
			const searchCondition = or(ilike(event.name, `%${search}%`), ilike(event.location, `%${search}%`));
			if (searchCondition) {
				whereConditions.push(searchCondition);
			}
		}

		const whereClause = and(...whereConditions);

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
			events: events.map((e) => ({
				...e,
				gearRequirements: e.gearRequirements as z.infer<typeof baseEventSchema>["gearRequirements"],
				mapData: e.mapData as z.infer<typeof baseEventSchema>["mapData"],
			})),
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
			summary: "Get events for specific club",
			description: "Get events for a specific club with pagination, search, and sorting",
			params: z.object({
				clubId: z.string(),
			}),
			query: paginationQuerySchema.extend({
				search: z.string().optional(),
				sortBy: z.enum(["name", "dateStart"]).optional(),
				sortOrder: z.enum(["asc", "desc"]).optional(),
			}),
			response: {
				200: z.object({
					events: z.array(baseEventSchema),
					pagination: paginationResponseSchema,
				}),
				400: z.object({ error: z.string() }),
			},
		},
	},
);

eventsRouter.get(
	"/api/clubs/:clubId/events/count",
	async ({ params, query, response }) => {
		const clubId = params.clubId;

		if (!clubId) {
			return response.error({ error: "Club ID is required" }, 400);
		}

		const search = query?.search || "";

		const whereConditions = [eq(event.clubId, clubId)];

		if (search) {
			const searchCondition = or(ilike(event.name, `%${search}%`), ilike(event.location, `%${search}%`));
			if (searchCondition) {
				whereConditions.push(searchCondition);
			}
		}

		const whereClause = and(...whereConditions);

		const totalData = await db.select({ count: count() }).from(event).where(whereClause);
		const total = totalData[0]?.count || 0;

		return response.json({ count: total });
	},
	{
		schema: {
			tags: ["Events"],
			summary: "Count events for club",
			description: "Count events for a specific club with optional search filter",
			params: z.object({
				clubId: z.string(),
			}),
			query: z.object({
				search: z.string().optional(),
			}),
			response: {
				200: z.object({
					count: z.number(),
				}),
				400: z.object({ error: z.string() }),
			},
		},
	},
);

const eventImageUploadBodySchema = z.object({
	file: z.object({
		type: z.string(),
		size: z.number(),
	}),
});

eventsRouter.post(
	"/api/events/:id/image/upload-url",
	async ({ params, context, body, response }) => {
		const eventId = params.id;

		if (!eventId) {
			return response.error({ error: "Event ID is required" }, 400);
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

		const key = `event/${eventId}/image`;
		const uploadUrl = await getS3UploadUrl(key, body.file.type, body.file.size);

		return response.json(uploadUrl);
	},
	{
		auth: true,
		schema: {
			tags: ["Events"],
			summary: "Get event image upload URL",
			description: "Get presigned S3 URL for uploading event image",
			params: z.object({
				id: z.string(),
			}),
			body: eventImageUploadBodySchema,
			response: {
				200: z.object({
					url: z.string(),
					cdnUrl: z.string(),
					key: z.string(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

eventsRouter.delete(
	"/api/events/:id/image",
	async ({ params, context, response }) => {
		const eventId = params.id;

		if (!eventId) {
			return response.error({ error: "Event ID is required" }, 400);
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

		await db.update(event).set({ image: null }).where(eq(event.id, eventId));

		await logClubAudit({
			clubId: existingEvent.clubId,
			actionType: "EVENT_UPDATE",
			actionData: {
				id: eventId,
				imageRemoved: true,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Events"],
			summary: "Delete event image",
			description: "Delete event image",
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

const baseEventRegistrationSchema = createSelectSchema(eventRegistration);

const createEventRegistrationBodySchema = z.object({
	type: z.enum(["solo", "team"]),
	paymentMethod: z.enum(["cash", "bank"]),
	invitedUserIds: z.array(z.string()).optional(),
	invitedUsersNotOnApp: z
		.array(
			z.object({
				name: z.string().min(1),
				email: z.string().email(),
			}),
		)
		.optional(),
});

eventsRouter.post(
	"/api/events/:id/registrations",
	async ({ params, context, body, response }) => {
		const eventId = params.id;

		if (!eventId) {
			return response.error({ error: "Event ID is required" }, 400);
		}

		const eventData = await db.select().from(event).where(eq(event.id, eventId)).limit(1);

		if (!eventData[0]) {
			return response.error({ error: "Event not found" }, 404);
		}

		const eventRecord = eventData[0];

		const now = new Date();
		if (new Date(eventRecord.dateRegistrationsOpen) > now) {
			return response.error({ error: "Registrations are not open yet" }, 400);
		}

		if (new Date(eventRecord.dateRegistrationsClose) < now) {
			return response.error({ error: "Registrations are closed" }, 400);
		}

		const existingRegistrationData = await db
			.select()
			.from(eventRegistration)
			.where(and(eq(eventRegistration.eventId, eventId), eq(eventRegistration.createdById, context.user.id)))
			.limit(1);

		const registrationId = existingRegistrationData[0]?.id || randomUUIDv7();

		await db.transaction(async (tx) => {
			if (existingRegistrationData[0]) {
				await tx
					.update(eventRegistration)
					.set({
						type: body.type,
						paymentMethod: body.paymentMethod,
						updatedAt: new Date().toISOString(),
					})
					.where(eq(eventRegistration.id, registrationId));

				if (body.invitedUserIds) {
					await tx.delete(eventRegistrationToUser).where(eq(eventRegistrationToUser.a, registrationId));

					if (body.invitedUserIds.length > 0) {
						await tx.insert(eventRegistrationToUser).values(
							body.invitedUserIds.map((userId) => ({
								a: registrationId,
								b: userId,
							})),
						);
					}
				}

				if (body.invitedUsersNotOnApp) {
					await tx.delete(eventInvite).where(eq(eventInvite.eventRegistrationId, registrationId));

					if (body.invitedUsersNotOnApp.length > 0) {
						const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
						await tx.insert(eventInvite).values(
							body.invitedUsersNotOnApp.map((user) => ({
								id: randomUUIDv7(),
								eventId,
								eventRegistrationId: registrationId,
								name: user.name,
								email: user.email,
								token: randomUUIDv7(),
								expiresAt,
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							})),
						);
					}
				}
			} else {
				await tx.insert(eventRegistration).values({
					id: registrationId,
					eventId,
					createdById: context.user.id,
					type: body.type,
					paymentMethod: body.paymentMethod,
					attended: false,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				});

				if (body.invitedUserIds && body.invitedUserIds.length > 0) {
					await tx.insert(eventRegistrationToUser).values(
						body.invitedUserIds.map((userId) => ({
							a: registrationId,
							b: userId,
						})),
					);
				}

				if (body.invitedUsersNotOnApp && body.invitedUsersNotOnApp.length > 0) {
					const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
					await tx.insert(eventInvite).values(
						body.invitedUsersNotOnApp.map((user) => ({
							id: randomUUIDv7(),
							eventId,
							eventRegistrationId: registrationId,
							name: user.name,
							email: user.email,
							token: randomUUIDv7(),
							expiresAt,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
						})),
					);
				}
			}
		});

		const registration = await db
			.select()
			.from(eventRegistration)
			.where(eq(eventRegistration.id, registrationId))
			.limit(1);

		if (!registration[0]) {
			return response.error({ error: "Registration not found" }, 404);
		}

		return response.json({
			success: true,
			registration: registration[0],
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Events"],
			summary: "Create or update event registration",
			description: "Create or update event registration",
			params: z.object({
				id: z.string(),
			}),
			body: createEventRegistrationBodySchema,
			response: {
				200: z.object({
					success: z.boolean(),
					registration: baseEventRegistrationSchema,
				}),
				...responseSchema([400, 401, 404], z.object({ error: z.string() })),
			},
		},
	},
);

eventsRouter.put(
	"/api/events/:id/registrations/:registrationId/attendance",
	async ({ params, context, body, response }) => {
		const eventId = params.id;
		const registrationId = params.registrationId;

		if (!eventId || !registrationId) {
			return response.error({ error: "Event ID and Registration ID are required" }, 400);
		}

		const eventData = await db.select().from(event).where(eq(event.id, eventId)).limit(1);

		if (!eventData[0]) {
			return response.error({ error: "Event not found" }, 404);
		}

		const eventRecord = eventData[0];

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, eventRecord.clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			return response.error({ error: "Unauthorized - must be manager or owner" }, 403);
		}

		const updated = await db
			.update(eventRegistration)
			.set({
				attended: body.attended,
				updatedAt: new Date().toISOString(),
			})
			.where(and(eq(eventRegistration.id, registrationId), eq(eventRegistration.eventId, eventId)))
			.returning();

		if (!updated[0]) {
			return response.error({ error: "Registration not found" }, 404);
		}

		return response.json({
			success: true,
			registration: updated[0],
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Events"],
			summary: "Toggle attendance",
			description: "Toggle attendance for event registration",
			params: z.object({
				id: z.string(),
				registrationId: z.string(),
			}),
			body: z.object({
				attended: z.boolean(),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
					registration: baseEventRegistrationSchema,
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

eventsRouter.get(
	"/api/events/:id/registrations",
	async ({ params, context, response }) => {
		const eventId = params.id;

		if (!eventId) {
			return response.error({ error: "Event ID is required" }, 400);
		}

		const eventData = await db.select().from(event).where(eq(event.id, eventId)).limit(1);

		if (!eventData[0]) {
			return response.error({ error: "Event not found" }, 404);
		}

		const eventRecord = eventData[0];

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, eventRecord.clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			return response.error({ error: "Unauthorized - must be manager or owner" }, 403);
		}

		const registrations = await db.select().from(eventRegistration).where(eq(eventRegistration.eventId, eventId));

		return response.json({
			registrations,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Events"],
			summary: "Get event registrations",
			description: "Get all registrations for an event",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					registrations: z.array(baseEventRegistrationSchema),
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

eventsRouter.get(
	"/api/events/:id/registrations/count",
	async ({ params, response }) => {
		const eventId = params.id;

		if (!eventId) {
			return response.error({ error: "Event ID is required" }, 400);
		}

		const totalData = await db
			.select({ count: count() })
			.from(eventRegistration)
			.where(eq(eventRegistration.eventId, eventId));
		const total = totalData[0]?.count || 0;

		return response.json({ count: total });
	},
	{
		schema: {
			tags: ["Events"],
			summary: "Count event registrations",
			description: "Count registrations for an event",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					count: z.number(),
				}),
				400: z.object({ error: z.string() }),
			},
		},
	},
);

eventsRouter.get(
	"/api/events/:id/rules",
	async ({ params, response }) => {
		const eventId = params.id;

		if (!eventId) {
			return response.error({ error: "Event ID is required" }, 400);
		}

		const rules = await db.select().from(clubRule).where(eq(clubRule.eventId, eventId));

		return response.json({
			rules: rules.map((r) => ({
				...r,
				content: r.content as z.infer<typeof baseClubRuleSchema>["content"],
			})),
		});
	},
	{
		schema: {
			tags: ["Events"],
			summary: "Get rules associated with event",
			description: "Get all rules associated with an event",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					rules: z.array(baseClubRuleSchema),
				}),
				400: z.object({ error: z.string() }),
			},
		},
	},
);

export { eventsRouter };
