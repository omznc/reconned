import { apiError, Router } from "@reconned/router";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import * as z from "zod";
import { club, clubInvite, clubMembership, event, eventRegistration, review, user } from "../drizzle/schema";
import { db } from "../lib/db";
import { logger } from "../lib/posthog";

const dashboardRouter = new Router();

dashboardRouter.get(
	"/dashboard/clubs",
	async ({ context, response }) => {
		// Get user's club memberships first
		const memberships = await db
			.select({
				clubId: clubMembership.clubId,
				role: clubMembership.role,
			})
			.from(clubMembership)
			.where(eq(clubMembership.userId, context.user.id));

		logger.emit({
			severityText: "debug",
			body: "Dashboard: Found memberships",
			attributes: {
				user_id: context.user.id,
				membership_count: memberships.length,
				request_id: context.requestId,
			},
		});

		if (memberships.length === 0) {
			logger.emit({
				severityText: "debug",
				body: "Dashboard: No memberships found",
				attributes: {
					user_id: context.user.id,
					request_id: context.requestId,
				},
			});
			return response.json({ clubs: [] });
		}

		const clubIds = memberships.map((m) => m.clubId);

		const clubsData = await db.select().from(club).where(inArray(club.id, clubIds));

		logger.emit({
			severityText: "debug",
			body: "Dashboard: Found clubs",
			attributes: {
				user_id: context.user.id,
				club_count: clubsData.length,
				request_id: context.requestId,
			},
		});

		// Get stats for each club
		const clubsWithStats = await Promise.all(
			clubsData.map(async (clubData) => {
				const membership = memberships.find((m) => m.clubId === clubData.id);

				if (!membership) {
					throw apiError.notFound("Membership not found");
				}

				// Count members
				const memberCountResult = await db
					.select({ count: count() })
					.from(clubMembership)
					.where(eq(clubMembership.clubId, clubData.id));

				// Count events
				const eventCountResult = await db
					.select({ count: count() })
					.from(event)
					.where(eq(event.clubId, clubData.id));

				// Count reviews
				const reviewCountResult = await db
					.select({ count: count() })
					.from(review)
					.where(and(eq(review.clubId, clubData.id), eq(review.type, "CLUB")));

				// Get upcoming event
				const upcomingEvent = await db
					.select({
						id: event.id,
						name: event.name,
						dateStart: event.dateStart,
					})
					.from(event)
					.where(and(eq(event.clubId, clubData.id), sql`${event.dateStart} >= NOW()`))
					.orderBy(event.dateStart)
					.limit(1);

				// Get latest review
				const latestReview = await db
					.select({ content: review.content })
					.from(review)
					.where(and(eq(review.clubId, clubData.id), eq(review.type, "CLUB")))
					.orderBy(sql`${review.createdAt} DESC`)
					.limit(1);

				return {
					id: clubData.id,
					name: clubData.name,
					logo: clubData.logo,
					membershipRole: membership.role,
					memberCount: Number(memberCountResult[0]?.count || 0),
					eventCount: Number(eventCountResult[0]?.count || 0),
					reviewCount: Number(reviewCountResult[0]?.count || 0),
					upcomingEvent: upcomingEvent[0] || null,
					latestReview: latestReview[0] || null,
				};
			}),
		);

		// Transform to expected response format
		const clubs = clubsWithStats.map((c) => ({
			id: c.id,
			name: c.name,
			logo: c.logo,
			membershipRole: c.membershipRole,
			events: c.upcomingEvent
				? [
						{
							id: c.upcomingEvent.id,
							name: c.upcomingEvent.name,
							dateStart: c.upcomingEvent.dateStart,
						},
					]
				: [],
			_count: {
				members: c.memberCount,
				events: c.eventCount,
				reviews: c.reviewCount,
			},
			reviews: c.latestReview ? [{ content: c.latestReview.content }] : [],
		}));

		return response.json({ clubs });
	},
	{
		auth: true,
		schema: {
			tags: ["Dashboard"],
			summary: "Get clubs for sidebar",
			description: "Get clubs for dashboard sidebar with events preview",
			response: {
				200: z.object({
					clubs: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							logo: z.string().nullable(),
							membershipRole: z.enum(["USER", "MANAGER", "CLUB_OWNER"]),
							events: z.array(
								z.object({
									id: z.string(),
									name: z.string(),
									dateStart: z.string(),
								}),
							),
							_count: z.object({
								members: z.number(),
								events: z.number(),
								reviews: z.number(),
							}),
							reviews: z.array(z.object({ content: z.string() })),
						}),
					),
				}),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

dashboardRouter.get(
	"/dashboard/invites-count",
	async ({ context, response }) => {
		const userData = await db.select({ email: user.email }).from(user).where(eq(user.id, context.user.id)).limit(1);

		if (!userData[0]) {
			throw apiError.notFound("User not found");
		}

		const invitesCount = await db
			.select({ count: count() })
			.from(clubInvite)
			.where(and(eq(clubInvite.email, userData[0].email), eq(clubInvite.status, "PENDING")));

		return response.json({ count: Number(invitesCount[0]?.count || 0) });
	},
	{
		auth: true,
		schema: {
			tags: ["Dashboard"],
			summary: "Get count of pending invites",
			description: "Get count of pending invites for current user",
			response: {
				200: z.object({
					count: z.number(),
				}),
				401: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

dashboardRouter.get(
	"/dashboard/invite-requests-count",
	async ({ context, response }) => {
		const managedClubs = await db
			.select({ clubId: clubMembership.clubId })
			.from(clubMembership)
			.where(
				and(
					eq(clubMembership.userId, context.user.id),
					inArray(clubMembership.role, ["MANAGER", "CLUB_OWNER"]),
				),
			);

		const managedClubIds = managedClubs.map((m) => m.clubId);

		if (managedClubIds.length === 0) {
			return response.json({ clubs: [] });
		}

		const inviteRequestsByClub = await db
			.select({
				clubId: clubInvite.clubId,
				count: count(),
			})
			.from(clubInvite)
			.where(and(inArray(clubInvite.clubId, managedClubIds), eq(clubInvite.status, "REQUESTED")))
			.groupBy(clubInvite.clubId);

		return response.json({
			clubs: inviteRequestsByClub.map((r) => ({
				id: r.clubId,
				count: Number(r.count),
			})),
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Dashboard"],
			summary: "Get invite requests count by club",
			description: "Get count of invite requests grouped by club for managed clubs",
			response: {
				200: z.object({
					clubs: z.array(
						z.object({
							id: z.string(),
							count: z.number(),
						}),
					),
				}),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

dashboardRouter.get(
	"/dashboard/stats",
	async ({ context, response }) => {
		const userData = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				image: user.image,
				headerImage: user.headerImage,
			})
			.from(user)
			.where(eq(user.id, context.user.id))
			.limit(1);

		if (!userData[0]) {
			throw apiError.notFound("User not found");
		}

		const [eventRegistrationCount, clubMembershipCount, reviewsWrittenCount, reviewsReceivedCount] =
			await Promise.all([
				db
					.select({ count: count() })
					.from(eventRegistration)
					.where(eq(eventRegistration.createdById, context.user.id)),
				db.select({ count: count() }).from(clubMembership).where(eq(clubMembership.userId, context.user.id)),
				db.select({ count: count() }).from(review).where(eq(review.authorId, context.user.id)),
				db.select({ count: count() }).from(review).where(eq(review.userId, context.user.id)),
			]);

		const memberships = await db
			.select({
				id: clubMembership.id,
				role: clubMembership.role,
				clubId: clubMembership.clubId,
			})
			.from(clubMembership)
			.where(eq(clubMembership.userId, context.user.id));

		const clubMemberships = await Promise.all(
			memberships.map(async (m) => {
				const clubData = await db.select().from(club).where(eq(club.id, m.clubId)).limit(1);
				const clubRecord = clubData[0];

				if (!clubRecord) {
					return {
						id: m.id,
						role: m.role,
						club: null,
					};
				}

				const [membersCount, eventsCount, reviewsCount, upcomingEvents, latestReviews] = await Promise.all([
					db.select({ count: count() }).from(clubMembership).where(eq(clubMembership.clubId, clubRecord.id)),
					db.select({ count: count() }).from(event).where(eq(event.clubId, clubRecord.id)),
					db
						.select({ count: count() })
						.from(review)
						.where(and(eq(review.clubId, clubRecord.id), eq(review.type, "CLUB"))),
					db
						.select({
							id: event.id,
							name: event.name,
							dateStart: event.dateStart,
						})
						.from(event)
						.where(and(eq(event.clubId, clubRecord.id), sql`${event.dateStart} >= NOW()`))
						.orderBy(event.dateStart)
						.limit(1),
					db
						.select({ content: review.content })
						.from(review)
						.where(and(eq(review.clubId, clubRecord.id), eq(review.type, "CLUB")))
						.orderBy(sql`${review.createdAt} DESC`)
						.limit(1),
				]);

				return {
					id: m.id,
					role: m.role,
					club: {
						id: clubRecord.id,
						name: clubRecord.name,
						logo: clubRecord.logo,
						_count: {
							members: Number(membersCount[0]?.count || 0),
							events: Number(eventsCount[0]?.count || 0),
							reviews: Number(reviewsCount[0]?.count || 0),
						},
						events: upcomingEvents,
						reviews: latestReviews.map((r) => ({ content: r.content })),
					},
				};
			}),
		);

		const eventRegistrations = await db
			.select({
				id: eventRegistration.id,
				type: eventRegistration.type,
				event: {
					id: event.id,
					name: event.name,
					slug: event.slug,
					dateStart: event.dateStart,
				},
			})
			.from(eventRegistration)
			.innerJoin(event, eq(eventRegistration.eventId, event.id))
			.where(eq(eventRegistration.createdById, context.user.id))
			.orderBy(sql`${event.dateStart} DESC`)
			.limit(5);

		return response.json({
			eventRegistration: Number(eventRegistrationCount[0]?.count || 0),
			clubMembership: Number(clubMembershipCount[0]?.count || 0),
			reviewsWritten: Number(reviewsWrittenCount[0]?.count || 0),
			reviewsReceived: Number(reviewsReceivedCount[0]?.count || 0),
			clubMembershipDetails: clubMemberships.map((m) => ({
				id: m.id,
				role: m.role,
				club: m.club
					? {
							id: m.club.id,
							name: m.club.name,
							logo: m.club.logo,
							_count: {
								members: Number(m.club._count.members || 0),
								events: Number(m.club._count.events || 0),
								reviews: Number(m.club._count.reviews || 0),
							},
							events: (m.club.events as Array<{ id: string; name: string; dateStart: string }>) || [],
							reviews: (m.club.reviews as Array<{ content: string }>) || [],
						}
					: null,
			})),
			eventRegistrationDetails: eventRegistrations.map((r) => ({
				id: r.id,
				type: r.type,
				event: r.event
					? {
							id: r.event.id,
							name: r.event.name,
							slug: r.event.slug,
							dateStart: r.event.dateStart,
						}
					: null,
			})),
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Dashboard"],
			summary: "Get dashboard statistics",
			description: "Get user dashboard statistics with club memberships and event registrations",
			response: {
				200: z.object({
					eventRegistration: z.number(),
					clubMembership: z.number(),
					reviewsWritten: z.number(),
					reviewsReceived: z.number(),
					clubMembershipDetails: z.array(
						z.object({
							id: z.string(),
							role: z.string(),
							club: z
								.object({
									id: z.string(),
									name: z.string(),
									logo: z.string().nullable(),
									_count: z.object({
										members: z.number(),
										events: z.number(),
										reviews: z.number(),
									}),
									events: z.array(
										z.object({
											id: z.string(),
											name: z.string(),
											dateStart: z.string(),
										}),
									),
									reviews: z.array(z.object({ content: z.string() })),
								})
								.nullable(),
						}),
					),
					eventRegistrationDetails: z.array(
						z.object({
							id: z.string(),
							type: z.string(),
							event: z
								.object({
									id: z.string(),
									name: z.string(),
									slug: z.string().nullable(),
									dateStart: z.string(),
								})
								.nullable(),
						}),
					),
				}),
				401: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

export { dashboardRouter };
