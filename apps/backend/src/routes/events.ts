import { apiError, Router, responseSchema } from "@reconned/router";
import { randomUUIDv7 } from "bun";
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, type SQL, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import {
	club,
	clubMembership,
	clubRule,
	event,
	eventInvite,
	eventRegistration,
	eventRegistrationToUser,
	user,
} from "../drizzle/schema";
import { logClubAudit } from "../lib/audit-logger";
import { db } from "../lib/db";
import { logger, posthog } from "../lib/posthog";
import { baseClubRuleSchema, baseEventSchema, paginationQuerySchema, paginationResponseSchema } from "../lib/schemas";
import { deleteS3Files, getS3UploadUrl } from "../lib/storage";
import { Sanitize } from "../lib/user-sanitization";

const eventsRouter = new Router();

eventsRouter.get(
	"/events",
	async ({ context, query, response }) => {
		const { page, perPage } = query;
		const offset = (page - 1) * perPage;
		const search = query?.search || "";
		const isPrivateFilter = query?.isPrivate;
		const filter = query?.filter;

		const whereConditions = [];

		if (search) {
			whereConditions.push(or(ilike(event.name, `%${search}%`), ilike(event.location, `%${search}%`)));
		}

		const isAdmin = context.isAdmin;
		const requestingUserId = context.user?.id;

		// Handle "mine" filter - only show events from clubs the user is a member of
		if (filter === "mine" && requestingUserId) {
			const userClubMemberships = await db
				.select({ clubId: clubMembership.clubId })
				.from(clubMembership)
				.where(eq(clubMembership.userId, requestingUserId));

			const userClubIds = userClubMemberships.map((m) => m.clubId);

			if (userClubIds.length === 0) {
				// User is not a member of any clubs, return empty result
				return response.json({
					events: [],
					pagination: {
						page,
						perPage,
						total: 0,
						totalPages: 0,
					},
				});
			}
			whereConditions.push(inArray(event.clubId, userClubIds));
		}

		if (isPrivateFilter !== null && isPrivateFilter !== undefined) {
			whereConditions.push(eq(event.isPrivate, isPrivateFilter === "true"));
		}

		const publicClubCondition = sql`
			EXISTS (
				SELECT 1
				FROM "Club" c
				WHERE c."id" = ${event.clubId}
				AND c."isPrivate" = false
			)
		`;

		if (!requestingUserId || !context.user) {
			whereConditions.push(eq(event.isPrivate, false));
			whereConditions.push(publicClubCondition);
		} else if (!isAdmin) {
			const userClubMemberships = await db
				.select({ clubId: clubMembership.clubId })
				.from(clubMembership)
				.where(eq(clubMembership.userId, requestingUserId));

			const userClubIds = userClubMemberships.map((m) => m.clubId);

			if (userClubIds.length > 0) {
				whereConditions.push(
					or(and(eq(event.isPrivate, false), publicClubCondition), inArray(event.clubId, userClubIds)),
				);
			} else {
				whereConditions.push(eq(event.isPrivate, false));
				whereConditions.push(publicClubCondition);
			}
		}

		const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		// First, get attendee counts for all events
		const attendeeCountsSubquery = db
			.select({
				eventId: eventRegistration.eventId,
				attendeeCount: count(eventRegistration.id).as("attendeeCount"),
			})
			.from(eventRegistration)
			.groupBy(eventRegistration.eventId)
			.as("attendeeCounts");

		// Get events with club verification status and attendee counts for sorting
		const eventsWithData = await db
			.select({
				id: event.id,
				name: event.name,
				description: event.description,
				clubId: event.clubId,
				dateStart: event.dateStart,
				dateEnd: event.dateEnd,
				dateRegistrationsOpen: event.dateRegistrationsOpen,
				dateRegistrationsClose: event.dateRegistrationsClose,
				location: event.location,
				image: event.image,
				isPrivate: event.isPrivate,
				allowFreelancers: event.allowFreelancers,
				googleMapsLink: event.googleMapsLink,
				costPerPerson: event.costPerPerson,
				hasBreakfast: event.hasBreakfast,
				hasLunch: event.hasLunch,
				hasDinner: event.hasDinner,
				hasSnacks: event.hasSnacks,
				hasDrinks: event.hasDrinks,
				hasPrizes: event.hasPrizes,
				slug: event.slug,
				gearRequirements: event.gearRequirements,
				mapData: event.mapData,
				createdAt: event.createdAt,
				updatedAt: event.updatedAt,
				clubVerified: club.verified,
				attendeeCount: sql`COALESCE(${attendeeCountsSubquery.attendeeCount}, 0)`.mapWith(Number),
			})
			.from(event)
			.innerJoin(club, eq(event.clubId, club.id))
			.leftJoin(attendeeCountsSubquery, eq(event.id, attendeeCountsSubquery.eventId))
			.where(whereClause)
			.orderBy(
				desc(club.verified),
				sql`COALESCE(${attendeeCountsSubquery.attendeeCount}, 0) DESC`,
				asc(event.name),
			)
			.limit(perPage)
			.offset(offset);

		const events = eventsWithData.map((e) => ({
			id: e.id,
			name: e.name,
			description: e.description,
			clubId: e.clubId,
			image: e.image,
			allowFreelancers: e.allowFreelancers,
			slug: e.slug,
			dateStart: e.dateStart,
			dateEnd: e.dateEnd,
			dateRegistrationsOpen: e.dateRegistrationsOpen,
			dateRegistrationsClose: e.dateRegistrationsClose,
			location: e.location,
			isPrivate: e.isPrivate,
			googleMapsLink: e.googleMapsLink,
			costPerPerson: e.costPerPerson,
			hasBreakfast: e.hasBreakfast,
			hasLunch: e.hasLunch,
			hasDinner: e.hasDinner,
			hasSnacks: e.hasSnacks,
			hasDrinks: e.hasDrinks,
			hasPrizes: e.hasPrizes,
			gearRequirements: e.gearRequirements,
			mapData: e.mapData,
			createdAt: e.createdAt,
			updatedAt: e.updatedAt,
		}));

		const totalData = await db.select({ count: count() }).from(event).where(whereClause);
		const total = totalData[0]?.count || 0;

		logger.emit({
			severityText: "info",
			body: "Retrieved events list",
			attributes: {
				event_count: events.length,
				total_events: total,
				page,
				per_page: perPage,
				filter,
				search,
				user_id: requestingUserId || "anonymous",
				request_id: context.requestId,
			},
		});

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
				search: z.string().max(100).optional(),
				sortBy: z.enum(["name", "dateStart"]).optional(),
				sortOrder: z.enum(["asc", "desc"]).optional(),
				isPrivate: z.string().optional(),
				filter: z.enum(["mine"]).optional(),
			}),
			response: {
				200: z.object({
					events: z.array(baseEventSchema),
					pagination: paginationResponseSchema,
				}),
			},
			mcpTool: true,
		},
	},
);

eventsRouter.get(
	"/events/upcoming",
	async ({ query, context, response }) => {
		const limit = query.limit || 25;

		const whereConditions = [gte(event.dateStart, new Date().toISOString())];

		const isAdmin = context.isAdmin;
		const requestingUserId = context.user?.id;

		const publicClubCondition = sql`
			EXISTS (
				SELECT 1
				FROM "Club" c
				WHERE c."id" = ${event.clubId}
				AND c."isPrivate" = false
			)
		`;

		if (!requestingUserId || !context.user) {
			whereConditions.push(eq(event.isPrivate, false));
			whereConditions.push(publicClubCondition);
		} else if (!isAdmin) {
			const userClubMemberships = await db
				.select({ clubId: clubMembership.clubId })
				.from(clubMembership)
				.where(eq(clubMembership.userId, requestingUserId));

			const userClubIds = userClubMemberships.map((m) => m.clubId);

			if (userClubIds.length > 0) {
				whereConditions.push(
					or(and(eq(event.isPrivate, false), publicClubCondition), inArray(event.clubId, userClubIds)) as SQL,
				);
			} else {
				whereConditions.push(eq(event.isPrivate, false));
				whereConditions.push(publicClubCondition);
			}
		}

		const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		const eventsWithDetails = await db
			.select({
				id: event.id,
				name: event.name,
				description: event.description,
				clubId: event.clubId,
				dateStart: event.dateStart,
				dateEnd: event.dateEnd,
				dateRegistrationsOpen: event.dateRegistrationsOpen,
				dateRegistrationsClose: event.dateRegistrationsClose,
				location: event.location,
				image: event.image,
				isPrivate: event.isPrivate,
				allowFreelancers: event.allowFreelancers,
				googleMapsLink: event.googleMapsLink,
				costPerPerson: event.costPerPerson,
				hasBreakfast: event.hasBreakfast,
				hasLunch: event.hasLunch,
				hasDinner: event.hasDinner,
				hasSnacks: event.hasSnacks,
				hasDrinks: event.hasDrinks,
				hasPrizes: event.hasPrizes,
				slug: event.slug,
				gearRequirements: event.gearRequirements,
				mapData: event.mapData,
				createdAt: event.createdAt,
				updatedAt: event.updatedAt,
				clubName: club.name,
				clubVerified: club.verified,
			})
			.from(event)
			.innerJoin(club, eq(event.clubId, club.id))
			.where(whereClause)
			.orderBy(event.dateStart)
			.limit(limit);

		return response.json({
			events: eventsWithDetails.map((e) => ({
				id: e.id,
				name: e.name,
				description: e.description,
				clubId: e.clubId,
				dateStart: e.dateStart,
				dateEnd: e.dateEnd,
				dateRegistrationsOpen: e.dateRegistrationsOpen,
				dateRegistrationsClose: e.dateRegistrationsClose,
				location: e.location,
				image: e.image,
				isPrivate: e.isPrivate,
				allowFreelancers: e.allowFreelancers,
				googleMapsLink: e.googleMapsLink,
				costPerPerson: e.costPerPerson,
				hasBreakfast: e.hasBreakfast,
				hasLunch: e.hasLunch,
				hasDinner: e.hasDinner,
				hasSnacks: e.hasSnacks,
				hasDrinks: e.hasDrinks,
				hasPrizes: e.hasPrizes,
				slug: e.slug,
				gearRequirements: e.gearRequirements,
				mapData: e.mapData,
				createdAt: e.createdAt,
				updatedAt: e.updatedAt,
				club: {
					name: e.clubName,
					verified: e.clubVerified,
				},
			})),
		});
	},
	{
		schema: {
			tags: ["Events"],
			summary: "Get upcoming events",
			description: "Get upcoming events with privacy filtering",
			mcpTool: true,
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
	"/events/calendar",
	async ({ query, context, response }) => {
		const startDate = query?.startDate;
		const endDate = query?.endDate;

		if (!startDate || !endDate) {
			throw apiError.validation("Start date and end date are required");
		}

		const whereConditions = [gte(event.dateStart, startDate), lte(event.dateStart, endDate)];

		const isAdmin = context.isAdmin;
		const requestingUserId = context.user?.id;

		const publicClubCondition = sql`
			EXISTS (
				SELECT 1
				FROM "Club" c
				WHERE c."id" = ${event.clubId}
				AND c."isPrivate" = false
			)
		`;

		if (!requestingUserId || !context.user) {
			whereConditions.push(eq(event.isPrivate, false));
			whereConditions.push(publicClubCondition);
		} else if (!isAdmin) {
			const userClubMemberships = await db
				.select({ clubId: clubMembership.clubId })
				.from(clubMembership)
				.where(eq(clubMembership.userId, requestingUserId));

			const userClubIds = userClubMemberships.map((m) => m.clubId);

			if (userClubIds.length > 0) {
				whereConditions.push(
					or(and(eq(event.isPrivate, false), publicClubCondition), inArray(event.clubId, userClubIds)) as SQL,
				);
			} else {
				whereConditions.push(eq(event.isPrivate, false));
				whereConditions.push(publicClubCondition);
			}
		}

		const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		const eventsWithDetails = await db
			.select({
				id: event.id,
				name: event.name,
				description: event.description,
				eventClubId: event.clubId,
				dateStart: event.dateStart,
				dateEnd: event.dateEnd,
				dateRegistrationsOpen: event.dateRegistrationsOpen,
				dateRegistrationsClose: event.dateRegistrationsClose,
				location: event.location,
				image: event.image,
				isPrivate: event.isPrivate,
				allowFreelancers: event.allowFreelancers,
				googleMapsLink: event.googleMapsLink,
				costPerPerson: event.costPerPerson,
				hasBreakfast: event.hasBreakfast,
				hasLunch: event.hasLunch,
				hasDinner: event.hasDinner,
				hasSnacks: event.hasSnacks,
				hasDrinks: event.hasDrinks,
				hasPrizes: event.hasPrizes,
				slug: event.slug,
				gearRequirements: event.gearRequirements,
				mapData: event.mapData,
				createdAt: event.createdAt,
				updatedAt: event.updatedAt,
				clubId: club.id,
				clubName: club.name,
				clubVerified: club.verified,
				clubLogo: club.logo,
				clubSlug: club.slug,
			})
			.from(event)
			.innerJoin(club, eq(event.clubId, club.id))
			.where(whereClause)
			.orderBy(event.dateStart);

		return response.json({
			events: eventsWithDetails.map((e) => ({
				id: e.id,
				name: e.name,
				description: e.description,
				clubId: e.eventClubId,
				dateStart: e.dateStart,
				dateEnd: e.dateEnd,
				dateRegistrationsOpen: e.dateRegistrationsOpen,
				dateRegistrationsClose: e.dateRegistrationsClose,
				location: e.location,
				image: e.image,
				isPrivate: e.isPrivate,
				allowFreelancers: e.allowFreelancers,
				googleMapsLink: e.googleMapsLink,
				costPerPerson: e.costPerPerson,
				hasBreakfast: e.hasBreakfast,
				hasLunch: e.hasLunch,
				hasDinner: e.hasDinner,
				hasSnacks: e.hasSnacks,
				hasDrinks: e.hasDrinks,
				hasPrizes: e.hasPrizes,
				slug: e.slug,
				gearRequirements: e.gearRequirements,
				mapData: e.mapData,
				createdAt: e.createdAt,
				updatedAt: e.updatedAt,
				club: {
					id: e.clubId,
					name: e.clubName,
					verified: e.clubVerified,
					logo: e.clubLogo,
					slug: e.clubSlug,
				},
			})),
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
					events: z.array(
						baseEventSchema.extend({
							club: z
								.object({
									name: z.string(),
									verified: z.boolean(),
									logo: z.string().nullable(),
									slug: z.string().nullable(),
									id: z.string(),
								})
								.nullable(),
						}),
					),
				}),
				400: z.object({ error: z.string() }),
			},
		},
	},
);

eventsRouter.get(
	"/events/:id",
	async ({ params, context, response }) => {
		const eventId = params.id;

		if (!eventId) {
			throw apiError.validation("Event ID is required");
		}

		const eventData = await db
			.select()
			.from(event)
			.where(or(eq(event.id, eventId), eq(event.slug, eventId)))
			.limit(1);

		if (!eventData[0]) {
			throw apiError.notFound("Event not found");
		}

		const eventRecord = eventData[0];
		const clubData = await db
			.select({
				id: club.id,
				name: club.name,
				slug: club.slug,
				logo: club.logo,
				verified: club.verified,
				isPrivate: club.isPrivate,
			})
			.from(club)
			.where(eq(club.id, eventRecord.clubId))
			.limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Event not found");
		}

		const clubRecord = clubData[0];

		const isAdmin = context.isAdmin;
		const requestingUserId = context.user?.id;
		const isEffectivePrivate = eventRecord.isPrivate || clubRecord.isPrivate;

		if (isEffectivePrivate && !isAdmin) {
			if (!requestingUserId || !context.user) {
				throw apiError.notFound("Event not found");
			}

			const userMembership = await db
				.select()
				.from(clubMembership)
				.where(and(eq(clubMembership.clubId, eventRecord.clubId), eq(clubMembership.userId, requestingUserId)))
				.limit(1);

			if (!userMembership[0]) {
				throw apiError.notFound("Event not found");
			}
		}

		const registrationCount = await db
			.select({ count: count() })
			.from(eventRegistration)
			.where(eq(eventRegistration.eventId, eventRecord.id));

		return response.json({
			event: {
				...eventRecord,
				gearRequirements: eventRecord.gearRequirements as z.infer<typeof baseEventSchema>["gearRequirements"],
				mapData: eventRecord.mapData as z.infer<typeof baseEventSchema>["mapData"],
			},
			club: {
				id: clubRecord.id,
				name: clubRecord.name,
				slug: clubRecord.slug,
				logo: clubRecord.logo,
				verified: clubRecord.verified,
			},
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
					event: baseEventSchema.extend({
						gearRequirements: baseEventSchema.shape.gearRequirements,
						mapData: baseEventSchema.shape.mapData,
					}),
					club: z
						.object({
							id: z.string(),
							name: z.string(),
							slug: z.string().nullable(),
							logo: z.string().nullable(),
							verified: z.boolean(),
						})
						.nullable(),
					registrationCount: z.number(),
				}),
				400: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
			mcpTool: true,
		},
	},
);

async function validateEventSlug(slug: string, excludeEventId?: string): Promise<boolean> {
	const [eventBySlug, eventById] = await Promise.all([
		db.select().from(event).where(eq(event.slug, slug)).limit(1),
		db.select().from(event).where(eq(event.id, slug)).limit(1),
	]);

	if (excludeEventId) {
		return !(eventBySlug[0] && eventBySlug[0].id !== excludeEventId) && !eventById[0];
	}

	return !eventBySlug[0] && !eventById[0];
}

eventsRouter.post(
	"/events",
	async ({ context, body, response }) => {
		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, body.clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		if (body.slug) {
			const valid = await validateEventSlug(body.slug);
			if (!valid) {
				throw apiError.validation("This slug is already taken");
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
				.where(and(eq(clubRule.clubId, body.clubId), inArray(clubRule.id, body.ruleIds)));
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
			throw apiError.internal("Failed to create event");
		}

		// Track event creation
		posthog.capture({
			distinctId: context.user.id,
			event: "event_created",
			properties: {
				event_id: eventId,
				club_id: body.clubId,
				event_name: body.name,
				location: body.location,
				cost_per_person: body.costPerPerson,
				is_private: body.isPrivate || false,
				has_map: Boolean(body.mapData),
				rule_count: body.ruleIds?.length || 0,
				allow_freelancers: body.allowFreelancers || false,
				has_food: body.hasBreakfast || body.hasLunch || body.hasDinner || body.hasSnacks || false,
				has_drinks: body.hasDrinks || false,
				has_prizes: body.hasPrizes || false,
			},
		});

		return response.json({
			success: true,
			event: newEvent[0],
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
				name: z.string().min(1).max(100),
				description: z.string().min(1),
				costPerPerson: z.number().gte(0).lte(300),
				location: z.string().min(1).max(100),
				googleMapsLink: z.string().optional(),
				dateStart: z.string(),
				dateEnd: z.string(),
				dateRegistrationsOpen: z.string(),
				dateRegistrationsClose: z.string(),
				slug: z.string().max(50).optional(),
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
			mcpTool: true,
		},
	},
);

eventsRouter.put(
	"/events/:id",
	async ({ params, context, body, response }) => {
		const eventId = params.id;

		if (!eventId) {
			throw apiError.validation("Event ID is required");
		}

		const existingEventData = await db.select().from(event).where(eq(event.id, eventId)).limit(1);

		if (!existingEventData[0]) {
			throw apiError.notFound("Event not found");
		}

		const existingEvent = existingEventData[0];

		if (new Date(existingEvent.dateEnd) <= new Date()) {
			throw apiError.validation("You cannot update a finished event");
		}

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, existingEvent.clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		// Only validate slug if it's provided and different from existing
		// Normalize empty strings to null for comparison
		const normalizedBodySlug = body.slug?.trim() || null;
		const normalizedExistingSlug = existingEvent.slug || null;

		if (normalizedBodySlug && normalizedBodySlug !== normalizedExistingSlug) {
			const valid = await validateEventSlug(normalizedBodySlug, eventId);
			if (!valid) {
				throw apiError.validation("This slug is already taken");
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
					.where(and(eq(clubRule.clubId, existingEvent.clubId), inArray(clubRule.id, body.ruleIds)));
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
			throw apiError.internal("Failed to update event");
		}

		// Track event update
		posthog.capture({
			distinctId: context.user.id,
			event: "event_updated",
			properties: {
				event_id: eventId,
				club_id: existingEvent.clubId,
				event_name: body.name || existingEvent.name,
				location: body.location || existingEvent.location,
				cost_per_person: body.costPerPerson || existingEvent.costPerPerson,
				is_private: body.isPrivate || existingEvent.isPrivate,
				has_map: Boolean(body.mapData || existingEvent.mapData),
			},
		});

		return response.json({
			success: true,
			event: updatedEvent[0],
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
				name: z.string().min(1).max(100),
				description: z.string().min(1),
				costPerPerson: z.number().gte(0).lte(300),
				location: z.string().min(1).max(100),
				googleMapsLink: z.string().optional(),
				dateStart: z.string(),
				dateEnd: z.string(),
				dateRegistrationsOpen: z.string(),
				dateRegistrationsClose: z.string(),
				slug: z.string().max(50).optional(),
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
			mcpTool: true,
		},
	},
);

eventsRouter.delete(
	"/events/:id",
	async ({ params, context, response }) => {
		const eventId = params.id;

		if (!eventId) {
			throw apiError.validation("Event ID is required");
		}

		const existingEventData = await db.select().from(event).where(eq(event.id, eventId)).limit(1);

		if (!existingEventData[0]) {
			throw apiError.notFound("Event not found");
		}

		const existingEvent = existingEventData[0];

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, existingEvent.clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		if (existingEvent.image) {
			const imageKey = existingEvent.image.split("/").pop() || "";
			if (imageKey) {
				await deleteS3Files([imageKey], context.user.id);
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

		// Track event deletion
		posthog.capture({
			distinctId: context.user.id,
			event: "event_deleted",
			properties: {
				event_id: eventId,
				club_id: existingEvent.clubId,
				event_name: existingEvent.name,
				location: existingEvent.location,
				cost_per_person: existingEvent.costPerPerson,
				is_private: existingEvent.isPrivate,
			},
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
			mcpTool: true,
		},
	},
);

eventsRouter.get(
	"/clubs/:clubId/events",
	async ({ params, query, response }) => {
		const clubId = params.clubId;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
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
			mcpTool: true,
		},
	},
);

eventsRouter.get(
	"/clubs/:clubId/events/count",
	async ({ params, query, response }) => {
		const clubId = params.clubId;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
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
	"/events/:id/image/upload-url",
	async ({ params, context, body, response }) => {
		const eventId = params.id;

		if (!eventId) {
			throw apiError.validation("Event ID is required");
		}

		const existingEventData = await db.select().from(event).where(eq(event.id, eventId)).limit(1);

		if (!existingEventData[0]) {
			throw apiError.notFound("Event not found");
		}

		const existingEvent = existingEventData[0];

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, existingEvent.clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const key = `event/${eventId}/image`;
		const uploadUrl = await getS3UploadUrl(key, body.file.type, body.file.size, context.user.id);

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
	"/events/:id/image",
	async ({ params, context, response }) => {
		const eventId = params.id;

		if (!eventId) {
			throw apiError.validation("Event ID is required");
		}

		const existingEventData = await db.select().from(event).where(eq(event.id, eventId)).limit(1);

		if (!existingEventData[0]) {
			throw apiError.notFound("Event not found");
		}

		const existingEvent = existingEventData[0];

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, existingEvent.clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		if (existingEvent.image) {
			const imageKey = existingEvent.image.split("/").pop() || "";
			if (imageKey) {
				await deleteS3Files([imageKey], context.user.id);
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
	"/events/:id/registrations",
	async ({ params, context, body, response }) => {
		const eventId = params.id;

		if (!eventId) {
			throw apiError.validation("Event ID is required");
		}

		const eventData = await db.select().from(event).where(eq(event.id, eventId)).limit(1);

		if (!eventData[0]) {
			throw apiError.notFound("Event not found");
		}

		const eventRecord = eventData[0];

		const now = new Date();
		if (new Date(eventRecord.dateRegistrationsOpen) > now) {
			throw apiError.validation("Registrations are not open yet");
		}

		if (new Date(eventRecord.dateRegistrationsClose) < now) {
			throw apiError.validation("Registrations are closed");
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
			throw apiError.notFound("Registration not found");
		}

		// Track event registration
		const isUpdate = Boolean(existingRegistrationData[0]);
		posthog.capture({
			distinctId: context.user.id,
			event: isUpdate ? "event_registration_updated" : "event_registration_created",
			properties: {
				event_id: eventId,
				club_id: eventRecord.clubId,
				registration_id: registrationId,
				registration_type: body.type,
				payment_method: body.paymentMethod,
				team_members_count: (body.invitedUserIds?.length || 0) + (body.invitedUsersNotOnApp?.length || 0),
				invited_users_count: body.invitedUserIds?.length || 0,
				external_invites_count: body.invitedUsersNotOnApp?.length || 0,
				is_update: isUpdate,
			},
		});

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
			mcpTool: true,
		},
	},
);

eventsRouter.delete(
	"/events/:id/registrations",
	async ({ params, context, response }) => {
		const eventId = params.id;

		if (!eventId) {
			throw apiError.validation("Event ID is required");
		}

		if (!context.user) {
			throw apiError.unauthorized("Authentication required");
		}

		const eventData = await db.select().from(event).where(eq(event.id, eventId)).limit(1);

		if (!eventData[0]) {
			throw apiError.notFound("Event not found");
		}

		const existingRegistrationData = await db
			.select()
			.from(eventRegistration)
			.where(and(eq(eventRegistration.eventId, eventId), eq(eventRegistration.createdById, context.user.id)))
			.limit(1);

		if (!existingRegistrationData[0]) {
			throw apiError.notFound("Registration not found");
		}

		const registrationId = existingRegistrationData[0].id;

		await db.transaction(async (tx) => {
			// Delete related records first
			await tx.delete(eventRegistrationToUser).where(eq(eventRegistrationToUser.a, registrationId));

			await tx.delete(eventInvite).where(eq(eventInvite.eventRegistrationId, registrationId));

			// Delete the registration
			await tx.delete(eventRegistration).where(eq(eventRegistration.id, registrationId));
		});

		return response.json({
			success: true,
		});
	},
	{
		schema: {
			tags: ["Events"],
			summary: "Delete event registration",
			description: "Delete the current user's registration for an event",
			mcpTool: true,
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
				}),
				...responseSchema([400, 401, 404], z.object({ error: z.string() })),
			},
		},
	},
);

eventsRouter.put(
	"/events/:id/registrations/:registrationId/attendance",
	async ({ params, context, body, response }) => {
		const eventId = params.id;
		const registrationId = params.registrationId;

		if (!eventId || !registrationId) {
			throw apiError.validation("Event ID and Registration ID are required");
		}

		const eventData = await db.select().from(event).where(eq(event.id, eventId)).limit(1);

		if (!eventData[0]) {
			throw apiError.notFound("Event not found");
		}

		const eventRecord = eventData[0];

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, eventRecord.clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
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
			throw apiError.notFound("Registration not found");
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
			mcpTool: true,
		},
	},
);

eventsRouter.get(
	"/events/:id/registrations",
	async ({ params, context, response }) => {
		const eventId = params.id;

		if (!eventId) {
			throw apiError.validation("Event ID is required");
		}

		const eventData = await db.select().from(event).where(eq(event.id, eventId)).limit(1);

		if (!eventData[0]) {
			throw apiError.notFound("Event not found");
		}

		const eventRecord = eventData[0];

		const managerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, eventRecord.clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const registrations = await db.select().from(eventRegistration).where(eq(eventRegistration.eventId, eventId));

		// Enhance registrations with invited users and creator info
		const registrationsWithDetails = await Promise.all(
			registrations.map(async (registration) => {
				const sanitize = new Sanitize({
					requestingUserId: context.user?.id,
					targetUserId: registration.createdById,
					isAdmin: context.isAdmin,
				});

				// Get creator info
				const creatorData = await db
					.select({
						id: user.id,
						name: user.name,
						email: sanitize.field<string | null>(user.email, user.isPrivateEmail),
						phone: sanitize.field<string | null>(user.phone, user.isPrivatePhone),
						callsign: user.callsign,
						image: user.image,
					})
					.from(user)
					.where(eq(user.id, registration.createdById))
					.limit(1);

				// Get invited users (on platform)
				const invitedUsersData = await db
					.select()
					.from(eventRegistrationToUser)
					.where(eq(eventRegistrationToUser.a, registration.id));

				const invitedUsers = await Promise.all(
					invitedUsersData.map(async (regToUser) => {
						const sanitize = new Sanitize({
							requestingUserId: context.user?.id,
							targetUserId: regToUser.b,
							isAdmin: context.isAdmin,
						});

						const userData = await db
							.select({
								id: user.id,
								name: user.name,
								email: sanitize.field(user.email, user.isPrivateEmail),
								phone: sanitize.field(user.phone, user.isPrivatePhone),
								callsign: user.callsign,
								image: user.image,
							})
							.from(user)
							.where(eq(user.id, regToUser.b))
							.limit(1);
						return userData[0];
					}),
				);

				// Get invited users not on platform
				const invitedUsersNotOnApp = await db
					.select()
					.from(eventInvite)
					.where(eq(eventInvite.eventRegistrationId, registration.id));

				return {
					...registration,
					createdBy: creatorData[0]
						? {
								id: String(creatorData[0].id),
								name: String(creatorData[0].name),
								email: creatorData[0].email,
								phone: creatorData[0].phone,
								callsign: creatorData[0].callsign ? String(creatorData[0].callsign) : null,
								image: creatorData[0].image ? String(creatorData[0].image) : null,
							}
						: null,
					invitedUsers: invitedUsers
						.filter((u): u is NonNullable<typeof u> => u !== undefined)
						.map((u) => ({
							id: String(u.id),
							name: String(u.name),
							email: u.email,
							phone: u.phone,
							callsign: u.callsign ? String(u.callsign) : null,
							image: u.image ? String(u.image) : null,
						})),
					invitedUsersNotOnApp,
				};
			}),
		);

		return response.json({
			registrations: registrationsWithDetails,
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
					registrations: z.array(
						baseEventRegistrationSchema.extend({
							createdBy: z
								.object({
									id: z.string(),
									name: z.string(),
									email: z.string().nullable(),
									phone: z.string().nullable(),
									callsign: z.string().nullable(),
									image: z.string().nullable(),
								})
								.nullable(),
							invitedUsers: z.array(
								z.object({
									id: z.string(),
									name: z.string(),
									email: z.string().nullable(),
									phone: z.string().nullable(),
									callsign: z.string().nullable(),
									image: z.string().nullable(),
								}),
							),
							invitedUsersNotOnApp: z.array(
								z.object({
									id: z.string(),
									eventId: z.string(),
									eventRegistrationId: z.string().nullable(),
									email: z.string(),
									name: z.string(),
									createdAt: z.string(),
									updatedAt: z.string(),
									expiresAt: z.string(),
								}),
							),
						}),
					),
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
			mcpTool: true,
		},
	},
);

eventsRouter.get(
	"/events/:id/registrations/count",
	async ({ params, response }) => {
		const eventId = params.id;

		if (!eventId) {
			throw apiError.validation("Event ID is required");
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
			mcpTool: true,
		},
	},
);

eventsRouter.get(
	"/events/:id/rules",
	async ({ params, response }) => {
		const eventId = params.id;

		if (!eventId) {
			throw apiError.validation("Event ID is required");
		}

		const rules = await db.select().from(clubRule).where(eq(clubRule.eventId, eventId));

		return response.json({
			rules,
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
			mcpTool: true,
		},
	},
);

eventsRouter.get(
	"/events/:id/apply-data",
	async ({ params, context, response }) => {
		const eventId = params.id;

		if (!eventId) {
			throw apiError.validation("Event ID is required");
		}

		if (!context.user) {
			throw apiError.unauthorized("Authentication required");
		}

		// Get event with conditional private check
		const eventData = await db
			.select()
			.from(event)
			.where(or(eq(event.id, eventId), eq(event.slug, eventId)))
			.limit(1);

		if (!eventData[0]) {
			throw apiError.notFound("Event");
		}

		const eventRecord = eventData[0];

		// Check if user has access to private event
		if (eventRecord.isPrivate) {
			const userMembership = await db
				.select()
				.from(clubMembership)
				.where(and(eq(clubMembership.clubId, eventRecord.clubId), eq(clubMembership.userId, context.user.id)))
				.limit(1);

			if (!userMembership[0]) {
				throw apiError.notFound("Event");
			}
		}

		// Get event rules
		const rules = await db.select().from(clubRule).where(eq(clubRule.eventId, eventRecord.id));

		// Get club info
		const clubData = await db.select().from(club).where(eq(club.id, eventRecord.clubId)).limit(1);

		// Get existing registration for this user
		const existingRegistration = await db
			.select()
			.from(eventRegistration)
			.where(
				and(eq(eventRegistration.eventId, eventRecord.id), eq(eventRegistration.createdById, context.user.id)),
			)
			.limit(1);

		let registrationWithInvites = null;

		if (existingRegistration[0]) {
			// Get invited users (on platform)
			const invitedUsersData = await db
				.select()
				.from(eventRegistrationToUser)
				.where(eq(eventRegistrationToUser.a, existingRegistration[0].id));

			const invitedUsers = (
				await Promise.all(
					invitedUsersData.map(async (regToUser) => {
						const sanitize = new Sanitize({
							requestingUserId: context.user?.id,
							targetUserId: regToUser.b,
							isAdmin: context.isAdmin,
						});

						const userData = await db
							.select({
								id: user.id,
								name: user.name,
								email: sanitize.field(user.email, user.isPrivateEmail),
								phone: sanitize.field(user.phone, user.isPrivatePhone),
								callsign: user.callsign,
								image: user.image,
							})
							.from(user)
							.where(eq(user.id, regToUser.b))
							.limit(1);
						return userData[0];
					}),
				)
			).filter(
				(
					u,
				): u is {
					id: string;
					name: string;
					email: string | null;
					phone: string | null;
					callsign: string | null;
					image: string | null;
				} => u !== undefined,
			);

			// Get invited users not on platform
			const invitedUsersNotOnApp = await db
				.select()
				.from(eventInvite)
				.where(eq(eventInvite.eventRegistrationId, existingRegistration[0].id));

			registrationWithInvites = {
				...existingRegistration[0],
				invitedUsers,
				invitedUsersNotOnApp,
				type: existingRegistration[0].type as "solo" | "team",
				paymentMethod: existingRegistration[0].paymentMethod as "cash" | "bank",
			};
		}

		return response.json({
			event: {
				...eventRecord,
				club: clubData[0]
					? {
							id: clubData[0].id,
						}
					: undefined,
				rules,
			},
			existingRegistration: registrationWithInvites,
		});
	},
	{
		schema: {
			tags: ["Events"],
			summary: "Get event application data",
			description:
				"Get event details with rules and user's existing registration for the application form. Requires authentication.",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					event: baseEventSchema.extend({
						club: z
							.object({
								id: z.string(),
							})
							.optional(),
						rules: z.array(baseClubRuleSchema),
					}),
					existingRegistration: z
						.object({
							id: z.string(),
							type: z.enum(["solo", "team"]),
							paymentMethod: z.enum(["cash", "bank"]),
							invitedUsers: z.array(
								z.object({
									id: z.string(),
									name: z.string(),
									email: z.string().nullable(),
									phone: z.string().nullable(),
									callsign: z.string().nullable(),
									image: z.string().nullable(),
								}),
							),
							invitedUsersNotOnApp: z.array(
								z.object({
									id: z.string(),
									eventId: z.string(),
									eventRegistrationId: z.string().nullable(),
									email: z.string(),
									name: z.string(),
								}),
							),
						})
						.nullable(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

export { eventsRouter };
