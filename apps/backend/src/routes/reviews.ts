import { apiError, Router } from "@reconned/router";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import * as z from "zod";
import { club, event, eventRegistration, eventRegistrationToUser, review, user } from "../drizzle/schema";
import { db } from "../lib/db";
import { isFeatureEnabled } from "../lib/feature-flags";
import { logger } from "../lib/posthog";
import { sanitizeReviewContent } from "../lib/sanitization";
import { paginationQuerySchema, paginationResponseSchema } from "../lib/schemas";

const reviewsRouter = new Router();

const reviewWithAuthorSchema = z.object({
	id: z.string(),
	type: z.enum(["USER", "CLUB", "EVENT"]),
	rating: z.number(),
	content: z.string(),
	authorId: z.string(),
	userId: z.string().nullable(),
	clubId: z.string().nullable(),
	eventId: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	author: z
		.object({
			id: z.string(),
			slug: z.string().nullable(),
			name: z.string(),
			image: z.string().nullable(),
		})
		.nullable(),
});

reviewsRouter.get(
	"/reviews/:type/:id",
	async ({ context, params, query, response }) => {
		const { type, id } = params;
		const { page, perPage, minRating, maxRating, rating } = query;

		if (!type || !id) {
			logger.emit({
				severityText: "warn",
				body: "Missing review type or ID",
				attributes: {
					type,
					id,
					request_id: context.requestId,
				},
			});
			throw apiError.validation("Type and ID are required");
		}

		const validTypes = ["user", "club", "event"];
		if (!validTypes.includes(type)) {
			logger.emit({
				severityText: "warn",
				body: "Invalid review type",
				attributes: {
					type,
					valid_types: validTypes,
					request_id: context.requestId,
				},
			});
			throw apiError.validation("Invalid review type. Must be 'user', 'club', or 'event'");
		}

		// Build the where condition based on type
		const baseCondition: ReturnType<typeof eq> =
			type === "user" ? eq(review.userId, id) : type === "club" ? eq(review.clubId, id) : eq(review.eventId, id);

		// Add rating filters if provided
		const conditions = [baseCondition];

		if (rating !== undefined) {
			// Filter by exact rating
			conditions.push(eq(review.rating, rating));
		} else {
			// Filter by rating range
			if (minRating !== undefined) {
				conditions.push(gte(review.rating, minRating));
			}
			if (maxRating !== undefined) {
				conditions.push(lte(review.rating, maxRating));
			}
		}

		const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);

		// Get total count for pagination
		const totalResult = await db.select({ total: count() }).from(review).where(whereCondition);
		const total = totalResult[0]?.total || 0;

		// Fetch reviews with author information (respecting privacy settings)
		const reviews = await db
			.select({
				id: review.id,
				type: review.type,
				rating: review.rating,
				content: review.content,
				authorId: review.authorId,
				userId: review.userId,
				clubId: review.clubId,
				eventId: review.eventId,
				createdAt: review.createdAt,
				updatedAt: review.updatedAt,
				author: {
					id: user.id,
					slug: user.slug,
					name: user.name,
					image: user.image,
					isPrivate: user.isPrivate,
				},
			})
			.from(review)
			.leftJoin(user, eq(review.authorId, user.id))
			.where(whereCondition)
			.orderBy(desc(review.createdAt))
			.limit(perPage)
			.offset((page - 1) * perPage);

		// Apply privacy sanitization to author info
		const sanitizedReviews = reviews.map((reviewItem) => ({
			...reviewItem,
			author: reviewItem.author
				? {
						id: reviewItem.author.id,
						slug: reviewItem.author.slug,
						// For reviews, show name regardless of privacy (they wrote public content)
						// But hide image if profile is private
						name: reviewItem.author.name,
						image: reviewItem.author.isPrivate ? null : reviewItem.author.image,
					}
				: null,
		}));

		logger.emit({
			severityText: "info",
			body: "Retrieved reviews",
			attributes: {
				type,
				entity_id: id,
				review_count: sanitizedReviews.length,
				total_reviews: total,
				page,
				request_id: context.requestId,
			},
		});

		return response.json({
			reviews: sanitizedReviews,
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
			tags: ["Reviews"],
			summary: "Get reviews",
			description: "Get reviews for a user, club, or event with pagination and optional rating filtering",
			params: z.object({
				type: z.enum(["user", "club", "event"]),
				id: z.string(),
			}),
			query: paginationQuerySchema.extend({
				minRating: z.coerce.number().int().min(1).max(5).optional(),
				maxRating: z.coerce.number().int().min(1).max(5).optional(),
				rating: z.coerce.number().int().min(1).max(5).optional(),
			}),
			response: {
				200: z.object({
					reviews: z.array(reviewWithAuthorSchema),
					pagination: paginationResponseSchema,
				}),
			},
		},
	},
);

const createReviewBodySchema = z.object({
	type: z.enum(["USER", "CLUB", "EVENT"]),
	rating: z.number().int().min(1).max(5),
	content: z.string().min(1).max(5000),
	userId: z.string().optional(),
	clubId: z.string().optional(),
	eventId: z.string().optional(),
});

reviewsRouter.post(
	"/reviews",
	async ({ body, response, context }) => {
		if (!context.user) {
			logger.emit({
				severityText: "warn",
				body: "Unauthorized review attempt",
				attributes: {
					request_id: context.requestId,
				},
			});
			throw apiError.unauthorized("You must be logged in to leave a review");
		}

		const reviewsEnabled = await isFeatureEnabled("REVIEWS");
		if (!reviewsEnabled) {
			logger.emit({
				severityText: "warn",
				body: "Reviews feature disabled",
				attributes: {
					user_id: context.user.id,
					request_id: context.requestId,
				},
			});
			throw apiError.forbidden("Reviews are currently disabled");
		}

		const { type, rating, content, userId, clubId, eventId } = body;

		const sanitizedContent = sanitizeReviewContent(content);

		const authorId = context.user.id;

		// Validate entity ID is provided based on type
		if (type === "USER" && !userId) {
			logger.emit({
				severityText: "warn",
				body: "Missing userId for user review",
				attributes: {
					user_id: authorId,
					request_id: context.requestId,
				},
			});
			throw apiError.validation("userId is required for user reviews");
		}
		if (type === "CLUB" && !clubId) {
			logger.emit({
				severityText: "warn",
				body: "Missing clubId for club review",
				attributes: {
					user_id: authorId,
					request_id: context.requestId,
				},
			});
			throw apiError.validation("clubId is required for club reviews");
		}
		if (type === "EVENT" && !eventId) {
			logger.emit({
				severityText: "warn",
				body: "Missing eventId for event review",
				attributes: {
					user_id: authorId,
					request_id: context.requestId,
				},
			});
			throw apiError.validation("eventId is required for event reviews");
		}

		// Can't review yourself
		if (type === "USER" && userId === authorId) {
			logger.emit({
				severityText: "warn",
				body: "User attempted to review themselves",
				attributes: {
					user_id: authorId,
					request_id: context.requestId,
				},
			});
			throw apiError.validation("You cannot review yourself");
		}

		// Validate entity existence
		if (type === "USER") {
			const userRecord = await db
				.select({ id: user.id })
				.from(user)
				.where(eq(user.id, userId as string))
				.limit(1);

			if (!userRecord.length) {
				logger.emit({
					severityText: "warn",
					body: "User not found for review",
					attributes: {
						target_user_id: userId,
						author_id: authorId,
						request_id: context.requestId,
					},
				});
				throw apiError.notFound("User");
			}
		}

		if (type === "CLUB") {
			const clubRecord = await db
				.select({ id: club.id })
				.from(club)
				.where(eq(club.id, clubId as string))
				.limit(1);

			if (!clubRecord.length) {
				logger.emit({
					severityText: "warn",
					body: "Club not found for review",
					attributes: {
						target_club_id: clubId,
						author_id: authorId,
						request_id: context.requestId,
					},
				});
				throw apiError.notFound("Club");
			}
		}

		// For event reviews: must be an attendee AND event must be finished
		if (type === "EVENT") {
			const eventRecord = await db
				.select({
					id: event.id,
					dateEnd: event.dateEnd,
				})
				.from(event)
				.where(eq(event.id, eventId as string))
				.limit(1);

			if (!eventRecord.length) {
				logger.emit({
					severityText: "warn",
					body: "Event not found for review",
					attributes: {
						target_event_id: eventId,
						author_id: authorId,
						request_id: context.requestId,
					},
				});
				throw apiError.notFound("Event");
			}

			const eventData =
				eventRecord[0] ??
				(() => {
					throw apiError.notFound("Event");
				})();

			// Check if event has finished
			if (new Date(eventData.dateEnd) > new Date()) {
				logger.emit({
					severityText: "warn",
					body: "Attempt to review unfinished event",
					attributes: {
						event_id: eventId,
						author_id: authorId,
						event_end_date: eventData.dateEnd,
						request_id: context.requestId,
					},
				});
				throw apiError.validation("You can only review events that have finished");
			}

			// Check if user was registered (attended or not)
			const registration = await db
				.select({
					registrationId: eventRegistrationToUser.a,
					eventId: eventRegistration.eventId,
				})
				.from(eventRegistrationToUser)
				.innerJoin(eventRegistration, eq(eventRegistrationToUser.a, eventRegistration.id))
				.where(and(eq(eventRegistrationToUser.b, authorId), eq(eventRegistration.eventId, eventId as string)))
				.limit(1);

			if (!registration.length) {
				logger.emit({
					severityText: "warn",
					body: "Attempt to review event without attending",
					attributes: {
						event_id: eventId,
						author_id: authorId,
						request_id: context.requestId,
					},
				});
				throw apiError.forbidden("You can only review events you attended");
			}
		}

		// Check if review already exists
		let whereCondition: ReturnType<typeof and>;

		switch (type) {
			case "USER":
				whereCondition = and(eq(review.authorId, authorId), eq(review.userId, userId as string));
				break;
			case "CLUB":
				whereCondition = and(eq(review.authorId, authorId), eq(review.clubId, clubId as string));
				break;
			case "EVENT":
				whereCondition = and(eq(review.authorId, authorId), eq(review.eventId, eventId as string));
				break;
		}

		const existingReviews = await db.select().from(review).where(whereCondition).limit(1);

		if (existingReviews.length > 0) {
			// Update existing review
			const existingReview =
				existingReviews[0] ??
				(() => {
					throw apiError.internal("Review not found");
				})();
			const updatedReview = {
				...existingReview,
				rating,
				content: sanitizedContent,
				updatedAt: new Date().toISOString(),
			};

			await db.update(review).set(updatedReview).where(eq(review.id, existingReview.id));

			logger.emit({
				severityText: "info",
				body: "Review updated",
				attributes: {
					review_id: existingReview.id,
					type,
					rating,
					author_id: authorId,
					request_id: context.requestId,
				},
			});

			return response.json({
				review: updatedReview,
			});
		}
		// Create new review
		const newReview = {
			id: crypto.randomUUID(),
			type,
			rating,
			content: sanitizedContent,
			authorId,
			userId: (type === "USER" ? userId : null) as string | null,
			clubId: (type === "CLUB" ? clubId : null) as string | null,
			eventId: (type === "EVENT" ? eventId : null) as string | null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		await db.insert(review).values(newReview);

		logger.emit({
			severityText: "info",
			body: "Review created",
			attributes: {
				review_id: newReview.id,
				type,
				rating,
				author_id: authorId,
				request_id: context.requestId,
			},
		});

		return response.json(
			{
				review: newReview,
			},
			201,
		);
	},
	{
		auth: true,
		rateLimit: {
			windowMs: 60000,
			maxRequests: 10,
		},
		schema: {
			tags: ["Reviews"],
			summary: "Create or update a review",
			description:
				"Leave a review for a user, club, or event. If you've already reviewed this entity, your previous review will be replaced. Event reviews require attendance and event completion.",
			body: createReviewBodySchema,
			response: {
				200: z.object({
					review: z.object({
						id: z.string(),
						type: z.enum(["USER", "CLUB", "EVENT"]),
						rating: z.number(),
						content: z.string(),
						authorId: z.string(),
						userId: z.string().nullable(),
						clubId: z.string().nullable(),
						eventId: z.string().nullable(),
						createdAt: z.string(),
						updatedAt: z.string(),
					}),
				}),
				201: z.object({
					review: z.object({
						id: z.string(),
						type: z.enum(["USER", "CLUB", "EVENT"]),
						rating: z.number(),
						content: z.string(),
						authorId: z.string(),
						userId: z.string().nullable(),
						clubId: z.string().nullable(),
						eventId: z.string().nullable(),
						createdAt: z.string(),
						updatedAt: z.string(),
					}),
				}),
			},
		},
	},
);

export { reviewsRouter };
