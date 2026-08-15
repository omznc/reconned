import { render } from "@react-email/components";
import { apiError, Router, responseSchema } from "@reconned/router";
import { randomUUIDv7 } from "bun";
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, ne, or, type SQL, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { club, clubMembership, clubRule, event, eventAttendee, eventRegistration, user } from "../drizzle/schema";
import EventInvitationEmail from "../emails/event-invitation";
import EventPlaceReleasedEmail from "../emails/event-place-released";
import EventWaitlistPromotedEmail from "../emails/event-waitlist-promoted";
import { logClubAudit } from "../lib/audit-logger";
import { getActiveMembership, requireClubManager } from "../lib/club-access";
import { db } from "../lib/db";
import { getEmailMessages, interpolateMessage } from "../lib/email-messages";
import { env } from "../lib/env";
import { isValidLanguage } from "../lib/i18n";
import { detach, sendEmail } from "../lib/mail";
import { logger, posthog } from "../lib/posthog";
import { baseClubRuleSchema, baseEventSchema, paginationQuerySchema, paginationResponseSchema } from "../lib/schemas";
import { deleteS3Files, getS3UploadUrl } from "../lib/storage";

function sanitizeField(
	value: string | null,
	isPrivate: boolean | null,
	requestingUserId?: string,
	targetUserId?: string,
	isAdmin?: boolean,
): string | null {
	if (isAdmin) return value;
	if (requestingUserId && requestingUserId === targetUserId) return value;
	return isPrivate ? null : value;
}

const eventsRouter = new Router();

/** `db`, or the transaction handle passed into a callback. */
type Db = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

interface AttendeePerson {
	attendeeId: string;
	id: string;
	name: string;
	email: string | null;
	phone: string | null;
	callsign: string | null;
	image: string | null;
	status: (typeof eventAttendee.status.enumValues)[number];
	attended: boolean | null;
	paidAt: string | null;
}

interface AttendeeGuest {
	attendeeId: string;
	id: string;
	name: string;
	email: string;
	status: (typeof eventAttendee.status.enumValues)[number];
	attended: boolean | null;
	paidAt: string | null;
}

interface BookingAttendees {
	leader: AttendeePerson | null;
	invitedUsers: AttendeePerson[];
	invitedUsersNotOnApp: AttendeeGuest[];
}

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

		// Fetch user club memberships once and reuse
		let userClubIds: string[] = [];
		if (requestingUserId) {
			const userClubMemberships = await db
				.select({ clubId: clubMembership.clubId })
				.from(clubMembership)
				.where(and(eq(clubMembership.userId, requestingUserId), eq(clubMembership.status, "ACTIVE")));

			userClubIds = userClubMemberships.map((m) => m.clubId);
		}

		// Handle "mine" filter - only show events from clubs the user is a member of
		if (filter === "mine" && requestingUserId) {
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

		// Attendee counts, constrained to the events actually visible to this request.
		// Without the inner filter this aggregates the ENTIRE EventRegistration table on
		// every page view, including registrations for events the caller can never see.
		const visibleEventIds = db.select({ id: event.id }).from(event).where(whereClause);

		// One row per person, so a team of five now counts as five. It used to count the
		// bookings, which made a busy event with big teams look emptier than a quiet one.
		const attendeeCountsSubquery = db
			.select({
				eventId: eventAttendee.eventId,
				attendeeCount: count(eventAttendee.id).as("attendeeCount"),
			})
			.from(eventAttendee)
			.where(and(inArray(eventAttendee.eventId, visibleEventIds), eq(eventAttendee.status, "CONFIRMED")))
			.groupBy(eventAttendee.eventId)
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
				maxAttendees: event.maxAttendees,
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
				clubSlug: club.slug,
				clubLogo: club.logo,
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
			maxAttendees: e.maxAttendees,
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
			club: {
				id: e.clubId,
				name: e.clubName,
				slug: e.clubSlug,
				logo: e.clubLogo,
			},
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
		cache: {
			key: "events",
			ttl: 300,
			swr: 1800,
			varyByQuery: ["page", "perPage", "search", "sortBy", "sortOrder", "isPrivate", "filter"],
			// NOT public-safe: the result set depends on the caller (private events of the
			// user's own clubs, admin visibility, and the "mine" filter).
			varyByUser: true,
		},
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
					events: z.array(
						baseEventSchema.extend({
							club: z
								.object({
									id: z.string(),
									name: z.string(),
									slug: z.string().nullable(),
									logo: z.string().nullable(),
								})
								.nullable(),
						}),
					),
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
				.where(and(eq(clubMembership.userId, requestingUserId), eq(clubMembership.status, "ACTIVE")));

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
				maxAttendees: event.maxAttendees,
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
				maxAttendees: e.maxAttendees,
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
		cache: {
			key: "events:upcoming",
			ttl: 300,
			varyByQuery: ["limit"],
			// NOT public-safe: includes private events from the caller's own clubs.
			varyByUser: true,
		},
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
				.where(and(eq(clubMembership.userId, requestingUserId), eq(clubMembership.status, "ACTIVE")));

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
				maxAttendees: event.maxAttendees,
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
				maxAttendees: e.maxAttendees,
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
		cache: {
			key: "events:calendar",
			ttl: 300,
			varyByQuery: ["startDate", "endDate"],
			// NOT public-safe: includes private events from the caller's own clubs.
			varyByUser: true,
		},
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

		const [clubData, registrationCountData, rulesData] = await Promise.all([
			db
				.select({
					id: club.id,
					name: club.name,
					slug: club.slug,
					logo: club.logo,
					verified: club.verified,
					description: club.description,
					isPrivate: club.isPrivate,
				})
				.from(club)
				.where(eq(club.id, eventRecord.clubId))
				.limit(1),
			db.select({ count: count() }).from(eventRegistration).where(eq(eventRegistration.eventId, eventRecord.id)),
			db.select().from(clubRule).where(eq(clubRule.eventId, eventRecord.id)),
		]);

		if (!clubData[0]) {
			throw apiError.notFound("Event not found");
		}

		const clubRecord = clubData[0];

		// registrationCount only counts registration rows; a team of five is one of those.
		// attendeeCount is the number of people actually expected, which is what a capacity
		// limit is measured against.
		const attendeeCount = await getEventHeadcount(eventRecord.id);

		const isAdmin = context.isAdmin;
		const requestingUserId = context.user?.id;
		const isEffectivePrivate = eventRecord.isPrivate || clubRecord.isPrivate;

		if (isEffectivePrivate && !isAdmin) {
			if (!requestingUserId || !context.user) {
				throw apiError.notFound("Event not found");
			}

			const membership = await getActiveMembership(eventRecord.clubId, requestingUserId);

			if (!membership) {
				throw apiError.notFound("Event not found");
			}
		}

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
				description: clubRecord.description,
			},
			registrationCount: Number(registrationCountData[0]?.count || 0),
			attendeeCount,
			// null means the event has no limit.
			placesLeft:
				eventRecord.maxAttendees === null ? null : Math.max(0, eventRecord.maxAttendees - attendeeCount),
			rules: rulesData,
		});
	},
	{
		cache: {
			key: "event:{id}",
			ttl: 300,
			// Private events (or events of private clubs) are membership-gated in the handler.
			// Only 2xx responses are cached, so a shared key would let a member's successful
			// response be replayed to a non-member. Must stay per-user.
			varyByUser: true,
		},
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
							description: z.string().nullable(),
						})
						.nullable(),
					registrationCount: z.number(),
					attendeeCount: z.number(),
					placesLeft: z.number().nullable(),
					rules: z.array(baseClubRuleSchema),
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

/**
 * Every mutating event route used to accept an id only, while GET /events/:id accepted an
 * id or a slug. Callers that resolved an event by slug then could not act on it.
 */
async function resolveEvent(idOrSlug: string) {
	const rows = await db
		.select()
		.from(event)
		.where(or(eq(event.id, idOrSlug), eq(event.slug, idOrSlug)))
		.limit(1);

	return rows[0] ?? null;
}

interface EventDates {
	dateStart: string;
	dateEnd: string;
	dateRegistrationsOpen: string;
	dateRegistrationsClose: string;
}

/**
 * Nothing previously checked that these four dates were ordered sensibly. An event could end
 * before it started, and registrations could close after the event ended — which made the
 * attendance tracker unreachable, since it only opens between the close and the end.
 */
function validateEventDates(dates: EventDates) {
	const start = new Date(dates.dateStart);
	const end = new Date(dates.dateEnd);
	const open = new Date(dates.dateRegistrationsOpen);
	const close = new Date(dates.dateRegistrationsClose);

	for (const [label, value] of [
		["dateStart", start],
		["dateEnd", end],
		["dateRegistrationsOpen", open],
		["dateRegistrationsClose", close],
	] as const) {
		if (Number.isNaN(value.getTime())) {
			throw apiError.validation(`${label} is not a valid date`);
		}
	}

	if (end <= start) {
		throw apiError.validation("The event must end after it starts");
	}

	if (close <= open) {
		throw apiError.validation("Registrations must close after they open");
	}

	if (close > end) {
		throw apiError.validation("Registrations must close before the event ends");
	}
}

/**
 * Freelancers are users who belong to no club. `allowFreelancers` was only ever enforced by a
 * disabled button in the apply form, so the API happily accepted them regardless.
 */
async function assertCanRegisterForEvent(eventRecord: typeof event.$inferSelect, userId: string, isAdmin: boolean) {
	const [clubData, membershipData] = await Promise.all([
		db.select({ isPrivate: club.isPrivate }).from(club).where(eq(club.id, eventRecord.clubId)).limit(1),
		db
			.select({ clubId: clubMembership.clubId })
			.from(clubMembership)
			.where(and(eq(clubMembership.userId, userId), eq(clubMembership.status, "ACTIVE"))),
	]);

	if (isAdmin) {
		return;
	}

	const isEffectivePrivate = eventRecord.isPrivate || Boolean(clubData[0]?.isPrivate);
	const isMemberOfHostClub = membershipData.some((m) => m.clubId === eventRecord.clubId);

	// Mirrors the visibility gate on GET /events/:id — you cannot register for something you
	// are not allowed to see.
	if (isEffectivePrivate && !isMemberOfHostClub) {
		throw apiError.notFound("Event not found");
	}

	if (!eventRecord.allowFreelancers && membershipData.length === 0) {
		throw apiError.forbidden("This event does not accept registrations from users without a club");
	}
}

/**
 * How long after an event the door list stays editable. Clubs reconcile the roster afterwards —
 * somebody turned up late, somebody was marked twice — and a hard cut-off at `dateEnd` would leave
 * those corrections with nowhere to go.
 */
const ATTENDANCE_GRACE_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * Attendance is a record of who was standing there, so it can only be written around the time
 * there was somebody to see. Nothing used to stop a manager marking a field full of people present
 * months before the event, and the roster gave no sign it had happened.
 *
 * The window opens when registrations close, which is when the roster stops moving under the
 * door's feet, and shuts a week after the event.
 */
function assertAttendanceWindow(eventRecord: typeof event.$inferSelect) {
	const now = Date.now();

	if (now < new Date(eventRecord.dateRegistrationsClose).getTime()) {
		throw apiError.validation("Attendance cannot be recorded until registrations have closed");
	}

	if (now > new Date(eventRecord.dateEnd).getTime() + ATTENDANCE_GRACE_MS) {
		throw apiError.validation("This event finished too long ago for attendance to be changed");
	}
}

/**
 * The number of people an event is committed to. One row, one person, so this is a plain count
 * rather than the three-way sum the old model needed.
 *
 * `excludeBookingId` answers "how many places would still be taken if this booking went away",
 * which is what editing an existing booking has to measure itself against.
 */
async function getEventHeadcount(eventId: string, excludeBookingId?: string, tx: Db = db) {
	const filters = [eq(eventAttendee.eventId, eventId), eq(eventAttendee.status, "CONFIRMED")];

	if (excludeBookingId) {
		filters.push(ne(eventAttendee.bookingId, excludeBookingId));
	}

	const rows = await tx
		.select({ value: count() })
		.from(eventAttendee)
		.where(and(...filters));

	return Number(rows[0]?.value ?? 0);
}

/**
 * Takes the event's row lock, then reports how many places are left.
 *
 * Capacity used to be checked with a plain read before the insert, so two people racing for the
 * last place both saw it free and both got in. Serialising on the event row is the cheapest
 * correct fix: everyone competing for places at one event queues behind the same lock, and
 * events do not contend with each other.
 */
async function lockEventAndCountPlaces(tx: Db, eventRecord: typeof event.$inferSelect, excludeBookingId?: string) {
	await tx.execute(sql`SELECT 1 FROM "Event" WHERE id = ${eventRecord.id} FOR UPDATE`);

	const taken = await getEventHeadcount(eventRecord.id, excludeBookingId, tx);
	const placesLeft = eventRecord.maxAttendees === null ? null : Math.max(0, eventRecord.maxAttendees - taken);

	return { taken, placesLeft };
}

/**
 * When a place frees up, the longest-waiting person on the list takes it. Called after anything
 * that can reduce the headcount, so "full" is a queue rather than a dead end.
 */
async function promoteFromWaitlist(tx: Db, eventRecord: typeof event.$inferSelect) {
	// No cap means nobody should be waiting at all, so an event that has just had its limit
	// lifted empties its list in one go.
	let freePlaces: number | null = null;

	if (eventRecord.maxAttendees !== null) {
		const taken = await getEventHeadcount(eventRecord.id, undefined, tx);
		freePlaces = eventRecord.maxAttendees - taken;

		if (freePlaces <= 0) {
			return [];
		}
	}

	const waitingQuery = tx
		.select({ id: eventAttendee.id })
		.from(eventAttendee)
		.where(and(eq(eventAttendee.eventId, eventRecord.id), eq(eventAttendee.status, "WAITLISTED")))
		.orderBy(asc(eventAttendee.invitedAt));

	const waiting = freePlaces === null ? await waitingQuery : await waitingQuery.limit(freePlaces);

	if (waiting.length === 0) {
		return [];
	}

	return tx
		.update(eventAttendee)
		.set({ status: "CONFIRMED", respondedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
		.where(
			inArray(
				eventAttendee.id,
				waiting.map((w) => w.id),
			),
		)
		.returning({ id: eventAttendee.id, userId: eventAttendee.userId });
}

/**
 * Loads a booking's people in the shape the API has always returned, so the storage change stays
 * invisible to the apply form: the leader separately, on-platform members as `invitedUsers`, and
 * off-platform guests as `invitedUsersNotOnApp`.
 */
async function loadBookingAttendees(bookingIds: string[], viewerId: string | undefined, isAdmin: boolean) {
	if (bookingIds.length === 0) {
		return new Map<string, BookingAttendees>();
	}

	const rows = await db
		.select({
			id: eventAttendee.id,
			bookingId: eventAttendee.bookingId,
			role: eventAttendee.role,
			status: eventAttendee.status,
			attended: eventAttendee.attended,
			paidAt: eventAttendee.paidAt,
			guestName: eventAttendee.guestName,
			guestEmail: eventAttendee.guestEmail,
			userId: user.id,
			name: user.name,
			email: user.email,
			phone: user.phone,
			callsign: user.callsign,
			image: user.image,
			isPrivateEmail: user.isPrivateEmail,
			isPrivatePhone: user.isPrivatePhone,
		})
		.from(eventAttendee)
		.leftJoin(user, eq(user.id, eventAttendee.userId))
		.where(inArray(eventAttendee.bookingId, bookingIds));

	const byBooking = new Map<string, BookingAttendees>();

	for (const row of rows) {
		let bucket = byBooking.get(row.bookingId);
		if (!bucket) {
			bucket = { leader: null, invitedUsers: [], invitedUsersNotOnApp: [] };
			byBooking.set(row.bookingId, bucket);
		}

		if (row.userId) {
			const person = {
				attendeeId: row.id,
				id: row.userId,
				name: row.name ?? "",
				email: sanitizeField(row.email, row.isPrivateEmail, viewerId, row.userId, isAdmin),
				phone: sanitizeField(row.phone, row.isPrivatePhone, viewerId, row.userId, isAdmin),
				callsign: row.callsign,
				image: row.image,
				status: row.status,
				attended: row.attended,
				paidAt: row.paidAt,
			};

			if (row.role === "LEADER") {
				bucket.leader = person;
			} else {
				bucket.invitedUsers.push(person);
			}
			continue;
		}

		bucket.invitedUsersNotOnApp.push({
			attendeeId: row.id,
			id: row.id,
			name: row.guestName ?? "",
			email: row.guestEmail ?? "",
			status: row.status,
			attended: row.attended,
			paidAt: row.paidAt,
		});
	}

	return byBooking;
}

eventsRouter.post(
	"/events",
	async ({ context, body, response }) => {
		await requireClubManager(body.clubId, context.user.id);

		validateEventDates(body);

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
				maxAttendees: body.maxAttendees ?? null,
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
		bustCache: ["events", "events:upcoming"],
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
				maxAttendees: z.number().int().positive().nullable().optional(),
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

		const existingEvent = await resolveEvent(eventId);

		if (!existingEvent) {
			throw apiError.notFound("Event not found");
		}

		if (new Date(existingEvent.dateEnd) <= new Date()) {
			throw apiError.validation("You cannot update a finished event");
		}

		validateEventDates(body);

		await requireClubManager(existingEvent.clubId, context.user.id);

		// Only validate slug if it's provided and different from existing
		// Normalize empty strings to null for comparison
		const normalizedBodySlug = body.slug?.trim() || null;
		const normalizedExistingSlug = existingEvent.slug || null;

		if (normalizedBodySlug && normalizedBodySlug !== normalizedExistingSlug) {
			const valid = await validateEventSlug(normalizedBodySlug, existingEvent.id);
			if (!valid) {
				throw apiError.validation("This slug is already taken");
			}
		}

		// Lowering the cap below the people already signed up would leave the event
		// permanently over capacity with no way for the organiser to reconcile it.
		if (body.maxAttendees !== undefined && body.maxAttendees !== null) {
			const headcount = await getEventHeadcount(existingEvent.id);
			if (body.maxAttendees < headcount) {
				throw apiError.validation(
					`The event already has ${headcount} attendees, the limit cannot be lower than that`,
				);
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
				maxAttendees: body.maxAttendees !== undefined ? body.maxAttendees : existingEvent.maxAttendees,
				hasBreakfast: body.hasBreakfast !== undefined ? body.hasBreakfast : existingEvent.hasBreakfast,
				hasLunch: body.hasLunch !== undefined ? body.hasLunch : existingEvent.hasLunch,
				hasDinner: body.hasDinner !== undefined ? body.hasDinner : existingEvent.hasDinner,
				hasSnacks: body.hasSnacks !== undefined ? body.hasSnacks : existingEvent.hasSnacks,
				hasDrinks: body.hasDrinks !== undefined ? body.hasDrinks : existingEvent.hasDrinks,
				hasPrizes: body.hasPrizes !== undefined ? body.hasPrizes : existingEvent.hasPrizes,
				mapData: body.mapData ? (body.mapData as Record<string, unknown>) : existingEvent.mapData,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(event.id, existingEvent.id))
			.returning();

		if (body.ruleIds) {
			await db.update(clubRule).set({ eventId: null }).where(eq(clubRule.eventId, existingEvent.id));

			if (body.ruleIds.length > 0) {
				await db
					.update(clubRule)
					.set({ eventId: existingEvent.id })
					.where(and(eq(clubRule.clubId, existingEvent.clubId), inArray(clubRule.id, body.ruleIds)));
			}
		}

		await logClubAudit({
			clubId: existingEvent.clubId,
			actionType: "EVENT_UPDATE",
			actionData: {
				id: existingEvent.id,
				name: body.name,
				description: body.description,
			},
			userId: context.user.id,
		});

		if (!updatedEvent[0]) {
			throw apiError.internal("Failed to update event");
		}

		// Opening more places is the one way capacity grows, and nothing else was watching for it.
		// A club that raised the cap by ten left ten people queueing until some unrelated
		// cancellation happened to move the list along.
		const capacityRose =
			updatedEvent[0].maxAttendees === null
				? existingEvent.maxAttendees !== null
				: existingEvent.maxAttendees !== null && updatedEvent[0].maxAttendees > existingEvent.maxAttendees;

		if (capacityRose) {
			const eventForPromotion = updatedEvent[0];
			const promoted = await db.transaction((tx) => promoteFromWaitlist(tx, eventForPromotion));
			detach("waitlist promotion emails", () => sendPromotionEmails(eventForPromotion, promoted));
		}

		// Track event update
		posthog.capture({
			distinctId: context.user.id,
			event: "event_updated",
			properties: {
				event_id: existingEvent.id,
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
		bustCache: ["events", "events:upcoming", "event:{id}"],
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
				maxAttendees: z.number().int().positive().nullable().optional(),
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

		const existingEvent = await resolveEvent(eventId);

		if (!existingEvent) {
			throw apiError.notFound("Event not found");
		}

		await requireClubManager(existingEvent.clubId, context.user.id);

		// EventRegistration references the event with ON DELETE RESTRICT, so the bookings have to
		// go before the event does. Attendees cascade off the booking, and club rules fall back
		// to null on their own.
		await db.transaction(async (tx) => {
			await tx.delete(eventAttendee).where(eq(eventAttendee.eventId, existingEvent.id));
			await tx.delete(eventRegistration).where(eq(eventRegistration.eventId, existingEvent.id));
			await tx.delete(event).where(eq(event.id, existingEvent.id));
		});

		// Only once the row is actually gone. Deleting the image first meant a failed delete
		// left the event in place with its image permanently destroyed.
		if (existingEvent.image) {
			const imageKey = existingEvent.image.split("/").pop() || "";
			if (imageKey) {
				await deleteS3Files([imageKey], context.user.id);
			}
		}

		await logClubAudit({
			clubId: existingEvent.clubId,
			actionType: "EVENT_DELETE",
			actionData: {
				id: existingEvent.id,
				name: existingEvent.name,
			},
			userId: context.user.id,
		});

		// Track event deletion
		posthog.capture({
			distinctId: context.user.id,
			event: "event_deleted",
			properties: {
				event_id: existingEvent.id,
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
		bustCache: ["events", "events:upcoming", "event:{id}"],
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

		await requireClubManager(existingEvent.clubId, context.user.id);

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

		await requireClubManager(existingEvent.clubId, context.user.id);

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

const attendeeStatusSchema = z.enum(eventAttendee.status.enumValues);

/**
 * A person on a booking. `attendeeId` addresses the attendee row itself, which is what the
 * per-person attendance route takes; `id` stays the user id the roster has always shown.
 */
const attendeePersonSchema = z.object({
	attendeeId: z.string(),
	id: z.string(),
	name: z.string(),
	email: z.string().nullable(),
	phone: z.string().nullable(),
	callsign: z.string().nullable(),
	image: z.string().nullable(),
	status: attendeeStatusSchema,
	/** `null` until somebody marks the roster. Not the same as absent. */
	attended: z.boolean().nullable(),
	/** When they settled up, or null if they have not. */
	paidAt: z.string().nullable(),
});

/** Someone brought along who has no account. `id` is the attendee row's own id. */
const attendeeGuestSchema = z.object({
	attendeeId: z.string(),
	id: z.string(),
	name: z.string(),
	email: z.string(),
	status: attendeeStatusSchema,
	attended: z.boolean().nullable(),
	paidAt: z.string().nullable(),
});

interface EventMailSubject {
	id: string;
	name: string;
	slug: string | null;
	dateStart: string;
	location: string;
	clubId: string;
}

/** The bits every event mail needs: who is hosting, when, and where to send people. */
async function eventEmailContext(eventRecord: EventMailSubject) {
	const clubData = await db
		.select({ name: club.name, logo: club.logo })
		.from(club)
		.where(eq(club.id, eventRecord.clubId))
		.limit(1);

	return {
		clubName: clubData[0]?.name ?? "",
		clubLogo: clubData[0]?.logo || `${env.FRONTEND_URL}/logo.png`,
		eventPath: `${env.FRONTEND_URL}/events/${eventRecord.slug || eventRecord.id}`,
		eventDate: new Date(eventRecord.dateStart).toLocaleString("en-GB", {
			dateStyle: "long",
			timeStyle: "short",
			timeZone: "UTC",
		}),
	};
}

/** Somebody who has just been put on a booking and has not heard about it yet. */
interface InviteRecipient {
	email: string;
	name: string | null;
	language: string | null;
	/** Guests already hold their place; members still have to accept. The copy differs. */
	isGuest: boolean;
	/** Guests only: the one-time token that ties their place to an account once they make one. */
	token?: string;
}

/**
 * Tells the people a captain just added that they are on a team. Without this the invite only
 * existed inside the app, so anyone who did not happen to open their invites page never learned
 * they were expected to turn up — the reason the roster kept filling with silent PENDING rows.
 *
 * Failures are logged and swallowed: a bounced mail must not undo a registration that is already
 * committed.
 */
async function sendInviteEmails(eventRecord: EventMailSubject, leaderName: string, recipients: InviteRecipient[]) {
	if (recipients.length === 0) {
		return;
	}

	try {
		const { clubName, clubLogo, eventPath, eventDate } = await eventEmailContext(eventRecord);
		const inviteUrl = `${env.FRONTEND_URL}/dashboard/user/invites`;

		await Promise.all(
			recipients.map(async (recipient) => {
				const language = isValidLanguage(recipient.language) ? recipient.language : "bs";
				const messages = getEmailMessages(language);

				await sendEmail({
					to: recipient.email,
					subject: interpolateMessage(messages.emails.eventInvitation.subject, {
						leaderName,
						eventName: eventRecord.name,
					}),
					html: await render(
						EventInvitationEmail({
							eventName: eventRecord.name,
							eventDate,
							eventLocation: eventRecord.location,
							leaderName,
							url: recipient.token
								? `${eventPath}/claim?token=${encodeURIComponent(recipient.token)}`
								: inviteUrl,
							name: recipient.name ?? undefined,
							clubLogo,
							clubName,
							isGuest: recipient.isGuest,
							language,
						}),
						{ pretty: true },
					),
				});
			}),
		);
	} catch (error) {
		logger.emit({
			severityText: "error",
			body: "Failed to send event invite emails",
			attributes: {
				event_id: eventRecord.id,
				recipient_count: recipients.length,
				error: error instanceof Error ? error.message : String(error),
			},
		});
	}
}

/**
 * Coming off the waiting list is the one change nobody asks for and nobody watches for, so it is
 * the one that has to reach them. Same swallow-and-log rule: the place is already theirs whether
 * or not the mail lands.
 */
async function sendPromotionEmails(eventRecord: EventMailSubject, promoted: { userId: string | null }[]) {
	const userIds = promoted.map((p) => p.userId).filter((id): id is string => id !== null);

	if (userIds.length === 0) {
		return;
	}

	try {
		const [{ clubName, clubLogo, eventPath, eventDate }, recipients] = await Promise.all([
			eventEmailContext(eventRecord),
			db
				.select({ email: user.email, name: user.name, language: user.language })
				.from(user)
				.where(inArray(user.id, userIds)),
		]);

		await Promise.all(
			recipients.map(async (recipient) => {
				const language = isValidLanguage(recipient.language) ? recipient.language : "bs";
				const messages = getEmailMessages(language);

				await sendEmail({
					to: recipient.email,
					subject: interpolateMessage(messages.emails.eventWaitlistPromoted.subject, {
						eventName: eventRecord.name,
					}),
					html: await render(
						EventWaitlistPromotedEmail({
							eventName: eventRecord.name,
							eventDate,
							eventLocation: eventRecord.location,
							url: eventPath,
							name: recipient.name,
							clubLogo,
							clubName,
							language,
						}),
						{ pretty: true },
					),
				});
			}),
		);
	} catch (error) {
		logger.emit({
			severityText: "error",
			body: "Failed to send waitlist promotion emails",
			attributes: {
				event_id: eventRecord.id,
				recipient_count: userIds.length,
				error: error instanceof Error ? error.message : String(error),
			},
		});
	}
}

/** Somebody a captain has just taken off their booking. Guests have no account, hence the shape. */
interface ReleasedRecipient {
	email: string;
	name: string | null;
	language: string | null;
}

/**
 * Being dropped from a team is the one roster change the app never surfaces to the person it
 * happened to — they hold no invite to expire and see nothing on their invites page. Without this
 * they find out at the gate.
 */
async function sendReleaseEmails(eventRecord: EventMailSubject, leaderName: string, recipients: ReleasedRecipient[]) {
	if (recipients.length === 0) {
		return;
	}

	try {
		const { clubName, clubLogo, eventPath, eventDate } = await eventEmailContext(eventRecord);

		await Promise.all(
			recipients.map(async (recipient) => {
				const language = isValidLanguage(recipient.language) ? recipient.language : "bs";
				const messages = getEmailMessages(language);

				await sendEmail({
					to: recipient.email,
					subject: interpolateMessage(messages.emails.eventPlaceReleased.subject, {
						eventName: eventRecord.name,
					}),
					html: await render(
						EventPlaceReleasedEmail({
							eventName: eventRecord.name,
							eventDate,
							eventLocation: eventRecord.location,
							leaderName,
							url: eventPath,
							name: recipient.name ?? undefined,
							clubLogo,
							clubName,
							language,
						}),
						{ pretty: true },
					),
				});
			}),
		);
	} catch (error) {
		logger.emit({
			severityText: "error",
			body: "Failed to send place released emails",
			attributes: {
				event_id: eventRecord.id,
				recipient_count: recipients.length,
				error: error instanceof Error ? error.message : String(error),
			},
		});
	}
}

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
	/**
	 * Opt in to being queued when the event is full instead of being turned away. Deliberately
	 * explicit: silently booking somebody onto a waiting list they did not ask for reads as a
	 * confirmed place, and they would only find out at the gate.
	 */
	joinWaitlist: z.boolean().optional(),
});

eventsRouter.post(
	"/events/:id/registrations",
	async ({ params, context, body, response }) => {
		const eventId = params.id;

		if (!eventId) {
			throw apiError.validation("Event ID is required");
		}

		const eventRecord = await resolveEvent(eventId);

		if (!eventRecord) {
			throw apiError.notFound("Event not found");
		}

		const now = new Date();
		if (new Date(eventRecord.dateRegistrationsOpen) > now) {
			throw apiError.validation("Registrations are not open yet");
		}

		if (new Date(eventRecord.dateRegistrationsClose) < now) {
			throw apiError.validation("Registrations are closed");
		}

		await assertCanRegisterForEvent(eventRecord, context.user.id, context.isAdmin);

		const existingRegistrationData = await db
			.select()
			.from(eventRegistration)
			.where(
				and(eq(eventRegistration.eventId, eventRecord.id), eq(eventRegistration.createdById, context.user.id)),
			)
			.limit(1);

		const registrationId = existingRegistrationData[0]?.id || randomUUIDv7();

		// Someone who has accepted a place on another team is already attending — letting them
		// register again counted them twice on the roster and against the capacity. The partial
		// unique index would refuse the insert anyway; this turns that into a readable error.
		const confirmedElsewhere = await db
			.select({ id: eventAttendee.id })
			.from(eventAttendee)
			.where(
				and(
					eq(eventAttendee.eventId, eventRecord.id),
					eq(eventAttendee.userId, context.user.id),
					eq(eventAttendee.status, "CONFIRMED"),
					ne(eventAttendee.bookingId, registrationId),
				),
			)
			.limit(1);

		if (confirmedElsewhere[0]) {
			throw apiError.validation("You are already attending this event as part of another team");
		}

		const invitedUserIds = body.invitedUserIds ? [...new Set(body.invitedUserIds)] : undefined;

		if (invitedUserIds && invitedUserIds.length > 0) {
			if (invitedUserIds.includes(context.user.id)) {
				throw apiError.validation("You cannot invite yourself to your own team");
			}

			// Unknown ids used to reach the insert and surface as a raw foreign key violation.
			const foundUsers = await db.select({ id: user.id }).from(user).where(inArray(user.id, invitedUserIds));

			if (foundUsers.length !== invitedUserIds.length) {
				throw apiError.validation("One or more invited users do not exist");
			}

			const alreadyTaken = await db
				.select({ id: eventAttendee.id })
				.from(eventAttendee)
				.where(
					and(
						eq(eventAttendee.eventId, eventRecord.id),
						eq(eventAttendee.status, "CONFIRMED"),
						inArray(eventAttendee.userId, invitedUserIds),
						ne(eventAttendee.bookingId, registrationId),
					),
				)
				.limit(1);

			if (alreadyTaken[0]) {
				throw apiError.validation("One or more invited users are already attending this event");
			}
		}

		// Two people can spell the same guest differently; the address is what identifies them.
		const guests = body.invitedUsersNotOnApp
			? [...new Map(body.invitedUsersNotOnApp.map((g) => [g.email.toLowerCase(), g])).values()]
			: undefined;

		if (guests && guests.length > 0) {
			const guestEmails = guests.map((g) => g.email.toLowerCase());

			const guestTaken = await db
				.select({ id: eventAttendee.id })
				.from(eventAttendee)
				.where(
					and(
						eq(eventAttendee.eventId, eventRecord.id),
						eq(eventAttendee.status, "CONFIRMED"),
						inArray(sql`lower(${eventAttendee.guestEmail})`, guestEmails),
						ne(eventAttendee.bookingId, registrationId),
					),
				)
				.limit(1);

			if (guestTaken[0]) {
				throw apiError.validation("One or more guests are already attending this event");
			}
		}

		// Only people who were not on the booking a moment ago get told about it. Editing a team
		// otherwise mailed everyone on it again every time the captain changed the payment method.
		const addedMemberIds: string[] = [];
		const addedGuests: { name: string; email: string; token: string }[] = [];
		// Anyone the edit takes off the booking. They were never told they were on it either way.
		const releasedMemberIds: string[] = [];
		const releasedGuests: { name: string | null; email: string }[] = [];

		const { promoted, waitlisted } = await db.transaction(async (tx) => {
			// The place check and the writes have to sit inside the same lock. Read it outside and
			// two people racing for the last place both see it free, and both get in.
			const { placesLeft } = await lockEventAndCountPlaces(tx, eventRecord, registrationId);

			// A booking already sitting on the waiting list stays there while it is edited. It
			// holds no places, so it is not measured against capacity and its new guests wait
			// alongside it rather than jumping the queue.
			const currentLeader = existingRegistrationData[0]
				? await tx
						.select({ status: eventAttendee.status })
						.from(eventAttendee)
						.where(and(eq(eventAttendee.bookingId, registrationId), eq(eventAttendee.role, "LEADER")))
						.limit(1)
				: [];

			// The registrant holds a place the moment they book, and so does everyone they bring
			// from off-platform, since nobody is going to ask those people to confirm. Invites to
			// app users stay PENDING and cost nothing until they are accepted.
			const requested = 1 + (guests?.length ?? 0);
			const short = placesLeft !== null && requested > placesLeft;

			// Only a brand new booking may choose the queue. Demoting an existing booking would
			// take places away from people who already hold them.
			const queued = currentLeader[0]
				? currentLeader[0].status === "WAITLISTED"
				: short && body.joinWaitlist === true;

			if (short && !queued) {
				throw apiError.validation(
					placesLeft === 0 ? "This event is full" : `This event only has ${placesLeft} place(s) left`,
				);
			}

			// What a place-holding row on this booking is worth right now. Members are still
			// PENDING until they answer, so this only governs the leader and the guests.
			const heldStatus = queued ? ("WAITLISTED" as const) : ("CONFIRMED" as const);

			const timestamp = new Date().toISOString();

			if (existingRegistrationData[0]) {
				await tx
					.update(eventRegistration)
					.set({
						type: body.type,
						paymentMethod: body.paymentMethod,
						updatedAt: timestamp,
					})
					.where(eq(eventRegistration.id, registrationId));
			} else {
				await tx.insert(eventRegistration).values({
					id: registrationId,
					eventId: eventRecord.id,
					createdById: context.user.id,
					type: body.type,
					paymentMethod: body.paymentMethod,
					attended: false,
					createdAt: timestamp,
					updatedAt: timestamp,
				});

				await tx.insert(eventAttendee).values({
					id: randomUUIDv7(),
					eventId: eventRecord.id,
					bookingId: registrationId,
					userId: context.user.id,
					role: "LEADER",
					status: heldStatus,
					respondedAt: timestamp,
					invitedAt: timestamp,
					createdAt: timestamp,
					updatedAt: timestamp,
				});
			}

			if (invitedUserIds) {
				// Rewriting the team wholesale would silently reset an accepted invite back to
				// PENDING, so only the rows that actually changed are touched.
				const currentMembers = await tx
					.select({ id: eventAttendee.id, userId: eventAttendee.userId })
					.from(eventAttendee)
					.where(
						and(
							eq(eventAttendee.bookingId, registrationId),
							eq(eventAttendee.role, "MEMBER"),
							// A guest row is reconciled against `guests`, not against the user list.
							sql`${eventAttendee.userId} IS NOT NULL`,
						),
					);

				const currentIds = new Set(currentMembers.map((m) => m.userId));
				const removed = currentMembers.filter((m) => m.userId && !invitedUserIds.includes(m.userId));
				const added = invitedUserIds.filter((id) => !currentIds.has(id));

				if (removed.length > 0) {
					await tx.delete(eventAttendee).where(
						inArray(
							eventAttendee.id,
							removed.map((m) => m.id),
						),
					);

					releasedMemberIds.push(...removed.map((m) => m.userId).filter((id): id is string => id !== null));
				}

				if (added.length > 0) {
					await tx.insert(eventAttendee).values(
						added.map((userId) => ({
							id: randomUUIDv7(),
							eventId: eventRecord.id,
							bookingId: registrationId,
							userId,
							role: "MEMBER" as const,
							status: "PENDING" as const,
							invitedAt: timestamp,
							createdAt: timestamp,
							updatedAt: timestamp,
						})),
					);

					addedMemberIds.push(...added);
				}
			}

			if (guests) {
				// A claimed guest has had its guest fields cleared and is an ordinary member row by
				// now, so it is deliberately outside this query — reconciling guests must not touch it.
				const existingGuests = await tx
					.select({ id: eventAttendee.id, name: eventAttendee.guestName, email: eventAttendee.guestEmail })
					.from(eventAttendee)
					.where(
						and(
							eq(eventAttendee.bookingId, registrationId),
							eq(eventAttendee.role, "MEMBER"),
							sql`${eventAttendee.guestEmail} IS NOT NULL`,
						),
					);

				const wanted = new Map(guests.map((guest) => [guest.email.toLowerCase(), guest]));
				const kept = new Set<string>();
				const staleIds: string[] = [];

				// Rewriting every guest on each edit would hand out fresh invite tokens and break the
				// links already sitting in people's inboxes, so only real changes are written.
				for (const existing of existingGuests) {
					const key = existing.email?.toLowerCase() ?? "";
					const match = wanted.get(key);

					if (!match) {
						staleIds.push(existing.id);
						releasedGuests.push({ name: existing.name, email: existing.email ?? "" });
						continue;
					}

					kept.add(key);

					if (match.name !== existing.name) {
						await tx
							.update(eventAttendee)
							.set({ guestName: match.name, updatedAt: timestamp })
							.where(eq(eventAttendee.id, existing.id));
					}
				}

				if (staleIds.length > 0) {
					await tx.delete(eventAttendee).where(inArray(eventAttendee.id, staleIds));
				}

				const newGuests = guests
					.filter((guest) => !kept.has(guest.email.toLowerCase()))
					.map((guest) => ({ ...guest, token: randomUUIDv7() }));

				addedGuests.push(...newGuests);

				if (newGuests.length > 0) {
					// The link stays good for as long as the place does. A fixed window meant a
					// guest invited to a match three months out had a dead link within a week.
					const expiresAt = eventRecord.dateEnd;
					await tx.insert(eventAttendee).values(
						newGuests.map((guest) => ({
							id: randomUUIDv7(),
							eventId: eventRecord.id,
							bookingId: registrationId,
							guestName: guest.name,
							guestEmail: guest.email,
							role: "MEMBER" as const,
							status: heldStatus,
							inviteToken: guest.token,
							inviteExpiresAt: expiresAt,
							invitedAt: timestamp,
							respondedAt: timestamp,
							createdAt: timestamp,
							updatedAt: timestamp,
						})),
					);
				}
			}

			// Dropping people from a team hands their places back, and the queue is still holding
			// the event's row lock here, so the next people in line take them straight away
			// rather than waiting for some unrelated cancellation to notice.
			const freed =
				releasedMemberIds.length > 0 || releasedGuests.length > 0
					? await promoteFromWaitlist(tx, eventRecord)
					: [];

			return { promoted: freed, waitlisted: queued };
		});

		const registration = await db
			.select()
			.from(eventRegistration)
			.where(eq(eventRegistration.id, registrationId))
			.limit(1);

		if (!registration[0]) {
			throw apiError.notFound("Registration not found");
		}

		// The booking is committed; none of these mails change that, so none of them are worth
		// making the captain wait on. They go out after the response.
		const leaderName = context.user.name;

		if (addedMemberIds.length > 0 || addedGuests.length > 0) {
			detach("event invite emails", async () => {
				const invitedUsers =
					addedMemberIds.length > 0
						? await db
								.select({ email: user.email, name: user.name, language: user.language })
								.from(user)
								.where(inArray(user.id, addedMemberIds))
						: [];

				await sendInviteEmails(eventRecord, leaderName, [
					...invitedUsers.map((invited) => ({
						email: invited.email,
						name: invited.name,
						language: invited.language,
						isGuest: false,
					})),
					...addedGuests.map((guest) => ({
						email: guest.email,
						name: guest.name,
						language: null,
						isGuest: true,
						token: guest.token,
					})),
				]);
			});
		}

		if (releasedMemberIds.length > 0 || releasedGuests.length > 0) {
			detach("event place released emails", async () => {
				const releasedUsers =
					releasedMemberIds.length > 0
						? await db
								.select({ email: user.email, name: user.name, language: user.language })
								.from(user)
								.where(inArray(user.id, releasedMemberIds))
						: [];

				await sendReleaseEmails(eventRecord, leaderName, [
					...releasedUsers,
					...releasedGuests.map((guest) => ({
						email: guest.email,
						name: guest.name,
						language: null,
					})),
				]);
			});
		}

		if (promoted.length > 0) {
			detach("waitlist promotion emails", () => sendPromotionEmails(eventRecord, promoted));
		}

		// Track event registration
		const isUpdate = Boolean(existingRegistrationData[0]);
		posthog.capture({
			distinctId: context.user.id,
			event: isUpdate ? "event_registration_updated" : "event_registration_created",
			properties: {
				event_id: eventRecord.id,
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
			waitlisted,
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
					/** True when the booking is queued rather than holding places. */
					waitlisted: z.boolean(),
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

		const eventRecord = await resolveEvent(eventId);

		if (!eventRecord) {
			throw apiError.notFound("Event not found");
		}

		const existingRegistrationData = await db
			.select()
			.from(eventRegistration)
			.where(
				and(eq(eventRegistration.eventId, eventRecord.id), eq(eventRegistration.createdById, context.user.id)),
			)
			.limit(1);

		if (!existingRegistrationData[0]) {
			throw apiError.notFound("Registration not found");
		}

		const registrationId = existingRegistrationData[0].id;

		const promoted = await db.transaction(async (tx) => {
			// The whole booking goes: the leader, their team invites and their guests.
			await tx.delete(eventAttendee).where(eq(eventAttendee.bookingId, registrationId));
			await tx.delete(eventRegistration).where(eq(eventRegistration.id, registrationId));

			// Cancelling is the main way places come back, so the queue moves here.
			return promoteFromWaitlist(tx, eventRecord);
		});

		detach("waitlist promotion emails", () => sendPromotionEmails(eventRecord, promoted));

		return response.json({
			success: true,
			promoted: promoted.length,
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
					/** How many waitlisted people took the places this booking gave back. */
					promoted: z.number(),
				}),
				...responseSchema([400, 401, 404], z.object({ error: z.string() })),
			},
		},
	},
);

eventsRouter.get(
	"/events/team-invites",
	async ({ context, response }) => {
		const invites = await db
			.select({
				registrationId: eventAttendee.bookingId,
				status: eventAttendee.status,
				invitedAt: eventAttendee.invitedAt,
				eventId: event.id,
				eventName: event.name,
				eventSlug: event.slug,
				eventDateStart: event.dateStart,
				eventLocation: event.location,
				invitedById: user.id,
				invitedByName: user.name,
			})
			.from(eventAttendee)
			.innerJoin(eventRegistration, eq(eventRegistration.id, eventAttendee.bookingId))
			.innerJoin(event, eq(event.id, eventAttendee.eventId))
			.innerJoin(user, eq(user.id, eventRegistration.createdById))
			.where(
				and(
					eq(eventAttendee.userId, context.user.id),
					// A waiting place is something the person is still holding out for, so it belongs
					// on the same page as the invitation it came from. Only PENDING wants an answer.
					inArray(eventAttendee.status, ["PENDING", "WAITLISTED"]),
					gte(event.dateEnd, new Date().toISOString()),
				),
			)
			.orderBy(asc(event.dateStart));

		return response.json({ invites });
	},
	{
		auth: true,
		schema: {
			tags: ["Events"],
			summary: "List pending team invites",
			description: "List the current user's pending invitations to join someone else's team registration",
			response: {
				200: z.object({
					invites: z.array(
						z.object({
							registrationId: z.string(),
							status: attendeeStatusSchema,
							invitedAt: z.string(),
							eventId: z.string(),
							eventName: z.string(),
							eventSlug: z.string().nullable(),
							eventDateStart: z.string(),
							eventLocation: z.string(),
							invitedById: z.string(),
							invitedByName: z.string(),
						}),
					),
				}),
				...responseSchema([401], z.object({ error: z.string() })),
			},
			mcpTool: true,
		},
	},
);

eventsRouter.put(
	"/events/:id/registrations/:registrationId/invite",
	async ({ params, context, body, response }) => {
		const eventId = params.id;
		const registrationId = params.registrationId;

		if (!eventId || !registrationId) {
			throw apiError.validation("Event ID and Registration ID are required");
		}

		const eventRecord = await resolveEvent(eventId);

		if (!eventRecord) {
			throw apiError.notFound("Event not found");
		}

		const inviteData = await db
			.select({ id: eventAttendee.id, status: eventAttendee.status })
			.from(eventAttendee)
			.where(
				and(
					eq(eventAttendee.bookingId, registrationId),
					eq(eventAttendee.userId, context.user.id),
					eq(eventAttendee.eventId, eventRecord.id),
					eq(eventAttendee.role, "MEMBER"),
				),
			)
			.limit(1);

		const invite = inviteData[0];

		if (!invite) {
			throw apiError.notFound("Invite not found");
		}

		if (new Date(eventRecord.dateEnd) < new Date()) {
			throw apiError.validation("This event is over");
		}

		if (body.status === "DECLINED") {
			const declined = await db
				.update(eventAttendee)
				.set({ status: "DECLINED", respondedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
				.where(eq(eventAttendee.id, invite.id))
				.returning({ status: eventAttendee.status });

			// Declining after having been confirmed hands a place back.
			if (invite.status === "CONFIRMED") {
				const promoted = await db.transaction((tx) => promoteFromWaitlist(tx, eventRecord));
				detach("waitlist promotion emails", () => sendPromotionEmails(eventRecord, promoted));
			}

			return response.json({ success: true, status: declined[0]?.status ?? "DECLINED" });
		}

		// Accepting is what actually books a place, so the double-booking and capacity checks
		// belong here rather than at invite time.
		const confirmedElsewhere = await db
			.select({ id: eventAttendee.id })
			.from(eventAttendee)
			.where(
				and(
					eq(eventAttendee.eventId, eventRecord.id),
					eq(eventAttendee.userId, context.user.id),
					eq(eventAttendee.status, "CONFIRMED"),
					ne(eventAttendee.bookingId, registrationId),
				),
			)
			.limit(1);

		if (confirmedElsewhere[0]) {
			throw apiError.validation("You are already attending this event as part of another team");
		}

		const status = await db.transaction(async (tx) => {
			const { placesLeft } = await lockEventAndCountPlaces(tx, eventRecord);

			// A full event does not turn an invite into a dead end. The place is queued for, and
			// whoever has been waiting longest takes the next one that frees up.
			const next = placesLeft === null || placesLeft > 0 ? "CONFIRMED" : "WAITLISTED";

			const updated = await tx
				.update(eventAttendee)
				.set({ status: next, respondedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
				.where(eq(eventAttendee.id, invite.id))
				.returning({ status: eventAttendee.status });

			if (!updated[0]) {
				throw apiError.notFound("Invite not found");
			}

			return updated[0].status;
		});

		return response.json({ success: true, status });
	},
	{
		auth: true,
		schema: {
			tags: ["Events"],
			summary: "Respond to a team invite",
			description: "Accept or reject an invitation to join someone else's team registration",
			params: z.object({
				id: z.string(),
				registrationId: z.string(),
			}),
			body: z.object({
				status: z.enum(["CONFIRMED", "DECLINED"]),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
					status: attendeeStatusSchema,
				}),
				...responseSchema([400, 401, 404], z.object({ error: z.string() })),
			},
			mcpTool: true,
		},
	},
);

eventsRouter.post(
	"/events/attendees/claim",
	async ({ context, body, response }) => {
		const rows = await db
			.select({
				id: eventAttendee.id,
				eventId: eventAttendee.eventId,
				userId: eventAttendee.userId,
				status: eventAttendee.status,
				expiresAt: eventAttendee.inviteExpiresAt,
				eventSlug: event.slug,
				eventName: event.name,
				eventDateEnd: event.dateEnd,
			})
			.from(eventAttendee)
			.innerJoin(event, eq(event.id, eventAttendee.eventId))
			.where(eq(eventAttendee.inviteToken, body.token))
			.limit(1);

		const attendee = rows[0];

		if (!attendee) {
			throw apiError.notFound("This invitation is no longer valid");
		}

		// The token is single-use; once it has bound a place to an account it is cleared, so a
		// row that still has one has not been claimed. This is belt and braces.
		if (attendee.userId) {
			throw apiError.validation("This invitation has already been claimed");
		}

		if (attendee.expiresAt && new Date(attendee.expiresAt) < new Date()) {
			throw apiError.validation("This invitation has expired");
		}

		if (new Date(attendee.eventDateEnd) < new Date()) {
			throw apiError.validation("This event is over");
		}

		const confirmedElsewhere = await db
			.select({ id: eventAttendee.id })
			.from(eventAttendee)
			.where(
				and(
					eq(eventAttendee.eventId, attendee.eventId),
					eq(eventAttendee.userId, context.user.id),
					eq(eventAttendee.status, "CONFIRMED"),
				),
			)
			.limit(1);

		if (confirmedElsewhere[0]) {
			throw apiError.validation("You are already attending this event");
		}

		// The guest fields go once the account owns the place. They are what marks a row as
		// off-platform, and leaving them behind would let a later team edit delete the row out
		// from under its new owner.
		const claimed = await db
			.update(eventAttendee)
			.set({
				userId: context.user.id,
				guestName: null,
				guestEmail: null,
				inviteToken: null,
				inviteExpiresAt: null,
				updatedAt: new Date().toISOString(),
			})
			.where(and(eq(eventAttendee.id, attendee.id), sql`${eventAttendee.userId} IS NULL`))
			.returning({ id: eventAttendee.id });

		if (!claimed[0]) {
			throw apiError.validation("This invitation has already been claimed");
		}

		posthog.capture({
			distinctId: context.user.id,
			event: "event_guest_place_claimed",
			properties: { event_id: attendee.eventId },
		});

		return response.json({
			success: true,
			eventId: attendee.eventId,
			eventSlug: attendee.eventSlug,
			eventName: attendee.eventName,
			status: attendee.status,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Events"],
			summary: "Claim a guest place",
			description:
				"Binds a place that was booked for an off-platform guest to the signed-in account, using the token from the invitation email",
			body: z.object({
				token: z.string().min(1),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
					eventId: z.string(),
					eventSlug: z.string().nullable(),
					eventName: z.string(),
					status: attendeeStatusSchema,
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

		const eventRecord = await resolveEvent(eventId);

		if (!eventRecord) {
			throw apiError.notFound("Event not found");
		}

		await requireClubManager(eventRecord.clubId, context.user.id);

		assertAttendanceWindow(eventRecord);

		const updated = await db.transaction(async (tx) => {
			const rows = await tx
				.update(eventRegistration)
				.set({
					attended: body.attended,
					updatedAt: new Date().toISOString(),
				})
				.where(and(eq(eventRegistration.id, registrationId), eq(eventRegistration.eventId, eventRecord.id)))
				.returning();

			if (!rows[0]) {
				throw apiError.notFound("Registration not found");
			}

			// Marking a booking present means marking the people on it present. Anyone who
			// declined or was never confirmed was not there, so they keep their own answer.
			await tx
				.update(eventAttendee)
				.set({ attended: body.attended, updatedAt: new Date().toISOString() })
				.where(and(eq(eventAttendee.bookingId, registrationId), eq(eventAttendee.status, "CONFIRMED")));

			return rows[0];
		});

		await logClubAudit({
			clubId: eventRecord.clubId,
			actionType: "EVENT_ATTENDANCE_UPDATE",
			actionData: {
				eventId: eventRecord.id,
				eventName: eventRecord.name,
				registrationId,
				attended: body.attended,
				scope: "booking",
			},
			userId: context.user.id,
		});

		return response.json({
			success: true,
			registration: updated,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Events"],
			summary: "Toggle attendance",
			description: "Toggle attendance for every confirmed person on an event registration",
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

eventsRouter.put(
	"/events/:id/attendees/:attendeeId/attendance",
	async ({ params, context, body, response }) => {
		const eventId = params.id;
		const attendeeId = params.attendeeId;

		if (!eventId || !attendeeId) {
			throw apiError.validation("Event ID and Attendee ID are required");
		}

		const eventRecord = await resolveEvent(eventId);

		if (!eventRecord) {
			throw apiError.notFound("Event not found");
		}

		await requireClubManager(eventRecord.clubId, context.user.id);

		assertAttendanceWindow(eventRecord);

		const updated = await db
			.update(eventAttendee)
			.set({ attended: body.attended, updatedAt: new Date().toISOString() })
			.where(and(eq(eventAttendee.id, attendeeId), eq(eventAttendee.eventId, eventRecord.id)))
			.returning({ id: eventAttendee.id, attended: eventAttendee.attended });

		if (!updated[0]) {
			throw apiError.notFound("Attendee not found");
		}

		await logClubAudit({
			clubId: eventRecord.clubId,
			actionType: "EVENT_ATTENDANCE_UPDATE",
			actionData: {
				eventId: eventRecord.id,
				eventName: eventRecord.name,
				attendeeId,
				attended: body.attended,
				scope: "person",
			},
			userId: context.user.id,
		});

		return response.json({ success: true, attendee: updated[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Events"],
			summary: "Mark one person present or absent",
			description:
				"Attendance is per person, not per booking: a team can turn up without one of its members. Pass null to clear the mark.",
			params: z.object({
				id: z.string(),
				attendeeId: z.string(),
			}),
			body: z.object({
				/** `null` means nobody has decided yet, which is not the same as absent. */
				attended: z.boolean().nullable(),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
					attendee: z.object({
						id: z.string(),
						attended: z.boolean().nullable(),
					}),
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
			mcpTool: true,
		},
	},
);

eventsRouter.put(
	"/events/:id/attendees/:attendeeId/payment",
	async ({ params, context, body, response }) => {
		const eventId = params.id;
		const attendeeId = params.attendeeId;

		if (!eventId || !attendeeId) {
			throw apiError.validation("Event ID and Attendee ID are required");
		}

		const eventRecord = await resolveEvent(eventId);

		if (!eventRecord) {
			throw apiError.notFound("Event not found");
		}

		await requireClubManager(eventRecord.clubId, context.user.id);

		// The booking records how somebody intends to pay; this records that they did. Marking
		// clears back to null rather than storing `false`, so "not paid yet" and "was never
		// asked" stay the same fact — money that has not arrived is money that has not arrived.
		const updated = await db
			.update(eventAttendee)
			.set({ paidAt: body.paid ? new Date().toISOString() : null, updatedAt: new Date().toISOString() })
			.where(and(eq(eventAttendee.id, attendeeId), eq(eventAttendee.eventId, eventRecord.id)))
			.returning({ id: eventAttendee.id, paidAt: eventAttendee.paidAt });

		if (!updated[0]) {
			throw apiError.notFound("Attendee not found");
		}

		await logClubAudit({
			clubId: eventRecord.clubId,
			actionType: "EVENT_PAYMENT_UPDATE",
			actionData: {
				eventId: eventRecord.id,
				eventName: eventRecord.name,
				attendeeId,
				paid: body.paid,
			},
			userId: context.user.id,
		});

		return response.json({ success: true, attendee: updated[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Events"],
			summary: "Mark one person paid or unpaid",
			description:
				"Records that a person on a booking has settled up. Payment is per person because a captain can pay for some of their team and not others.",
			params: z.object({
				id: z.string(),
				attendeeId: z.string(),
			}),
			body: z.object({
				paid: z.boolean(),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
					attendee: z.object({
						id: z.string(),
						/** When they settled up, or null if they have not. */
						paidAt: z.string().nullable(),
					}),
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

		const eventRecord = await resolveEvent(eventId);

		if (!eventRecord) {
			throw apiError.notFound("Event not found");
		}

		await requireClubManager(eventRecord.clubId, context.user.id);

		const registrations = await db
			.select()
			.from(eventRegistration)
			.where(eq(eventRegistration.eventId, eventRecord.id));

		if (registrations.length === 0) {
			return response.json({ registrations: [] });
		}

		const registrationIds = registrations.map((r) => r.id);

		const { isAdmin } = context;
		const requestingUserId = context.user?.id;

		// One query for every person on every booking, whichever side of the app they are on.
		const attendeesByBooking = await loadBookingAttendees(registrationIds, requestingUserId, isAdmin);

		// The leader is an attendee like everyone else now, but the roster has always shown them
		// as `createdBy`, so a booking whose leader row somehow went missing still resolves.
		const missingLeaders = registrations
			.filter((r) => !attendeesByBooking.get(r.id)?.leader)
			.map((r) => r.createdById);

		const fallbackLeaders = new Map<string, AttendeePerson>();

		if (missingLeaders.length > 0) {
			const rows = await db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					phone: user.phone,
					callsign: user.callsign,
					image: user.image,
					isPrivateEmail: user.isPrivateEmail,
					isPrivatePhone: user.isPrivatePhone,
				})
				.from(user)
				.where(inArray(user.id, [...new Set(missingLeaders)]));

			for (const row of rows) {
				fallbackLeaders.set(row.id, {
					attendeeId: "",
					id: row.id,
					name: row.name,
					email: sanitizeField(row.email, row.isPrivateEmail, requestingUserId, row.id, isAdmin),
					phone: sanitizeField(row.phone, row.isPrivatePhone, requestingUserId, row.id, isAdmin),
					callsign: row.callsign,
					image: row.image,
					status: "CONFIRMED",
					attended: null,
					paidAt: null,
				});
			}
		}

		const registrationsWithDetails = registrations.map((registration) => {
			const attendees = attendeesByBooking.get(registration.id);

			return {
				...registration,
				createdBy: attendees?.leader ?? fallbackLeaders.get(registration.createdById) ?? null,
				invitedUsers: attendees?.invitedUsers ?? [],
				invitedUsersNotOnApp: attendees?.invitedUsersNotOnApp ?? [],
			};
		});

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
							createdBy: attendeePersonSchema.nullable(),
							invitedUsers: z.array(attendeePersonSchema),
							invitedUsersNotOnApp: z.array(attendeeGuestSchema),
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
		cache: {
			key: "event:{id}:registrations",
			ttl: 300,
			// Plain registration count, identical for every caller.
			varyByUser: false,
		},
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
		cache: {
			key: "event:{id}:rules",
			ttl: 300,
			// Rules are the same for every caller.
			varyByUser: false,
		},
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
			const userMembership = await getActiveMembership(eventRecord.clubId, context.user.id);

			if (!userMembership) {
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
			const registrationId = existingRegistration[0].id;

			const attendees = (await loadBookingAttendees([registrationId], context.user?.id, context.isAdmin)).get(
				registrationId,
			);

			registrationWithInvites = {
				...existingRegistration[0],
				invitedUsers: attendees?.invitedUsers ?? [],
				invitedUsersNotOnApp: attendees?.invitedUsersNotOnApp ?? [],
				type: existingRegistration[0].type as "solo" | "team",
				paymentMethod: existingRegistration[0].paymentMethod as "cash" | "bank",
			};
		}

		// Everyone but this user, so that editing an existing registration is never blocked
		// by the places that registration itself is already holding.
		const headcountWithoutUser = await getEventHeadcount(eventRecord.id, existingRegistration[0]?.id);

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
			capacity: {
				maxAttendees: eventRecord.maxAttendees,
				takenByOthers: headcountWithoutUser,
				// null means unlimited.
				placesLeft:
					eventRecord.maxAttendees === null
						? null
						: Math.max(0, eventRecord.maxAttendees - headcountWithoutUser),
			},
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
							invitedUsers: z.array(attendeePersonSchema),
							invitedUsersNotOnApp: z.array(attendeeGuestSchema),
						})
						.nullable(),
					capacity: z.object({
						maxAttendees: z.number().int().nullable(),
						takenByOthers: z.number().int(),
						placesLeft: z.number().int().nullable(),
					}),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

export { eventsRouter };
