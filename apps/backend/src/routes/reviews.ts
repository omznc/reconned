import { apiError, Router } from "@reconned/router";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import * as z from "zod";
import { club, event, eventAttendee, review, reviewEditHistory, user } from "../drizzle/schema";
import { rateLimitKey, redisRateLimitStore } from "../lib/cache";
import { bustReviewCache } from "../lib/cache-bust";
import { db } from "../lib/db";
import { isFeatureEnabled } from "../lib/feature-flags";
import { logger } from "../lib/posthog";
import { redis } from "../lib/redis";
import { sanitizeReviewContent } from "../lib/sanitization";
import { paginationQuerySchema, paginationResponseSchema } from "../lib/schemas";

const REVIEWS_CACHE_TTL = 300;

const reviewsRouter = new Router();

function cachedJson<T>(data: T, cacheControl: string): Response {
	return new Response(JSON.stringify(data), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": cacheControl,
		},
	});
}

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
	async ({ context, params, query }) => {
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

		const hasRatingFilters = rating !== undefined || minRating !== undefined || maxRating !== undefined;
		const cacheKey = `reviews:${type}:${id}:page:${page}:perPage:${perPage}`;

		if (!hasRatingFilters) {
			try {
				const cached = await redis.get(cacheKey);
				if (cached) {
					return cachedJson(JSON.parse(cached), "public, max-age=300, stale-while-revalidate=1800");
				}
			} catch (error) {
				logger.emit({
					severityText: "error",
					body: "Error reading reviews from cache",
					attributes: { error: error instanceof Error ? error.message : String(error) },
				});
			}
		}

		// Build the where condition based on type
		const baseCondition: ReturnType<typeof eq> =
			type === "user" ? eq(review.userId, id) : type === "club" ? eq(review.clubId, id) : eq(review.eventId, id);

		// Add rating filters if provided
		const conditions = [baseCondition];

		if (rating !== undefined) {
			conditions.push(eq(review.rating, rating));
		} else {
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

		const result = {
			reviews: sanitizedReviews,
			pagination: {
				page,
				perPage,
				total,
				totalPages: Math.ceil(total / perPage),
			},
		};

		if (!hasRatingFilters) {
			try {
				await redis.setex(cacheKey, REVIEWS_CACHE_TTL, JSON.stringify(result));
			} catch (error) {
				logger.emit({
					severityText: "error",
					body: "Error caching reviews",
					attributes: { error: error instanceof Error ? error.message : String(error) },
				});
			}
		}

		return cachedJson(result, "public, max-age=300, stale-while-revalidate=1800");
	},
	{
		schema: {
			tags: ["Reviews"],
			summary: "Get reviews",
			description:
				"Get reviews for a user, club, or event with pagination and optional rating filtering. `id` is the club/event/user ID (a slug also works for clubs and events).",
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
			mcpTool: true,
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

			// Only someone who actually held a place may review. The single attendee table covers
			// solo registrants and team members alike; the old query only looked at the team join
			// table, so anyone who registered on their own was refused. Being *named* on a team is
			// still not attendance, which is why the status has to be CONFIRMED.
			const registration = await db
				.select({ id: eventAttendee.id })
				.from(eventAttendee)
				.where(
					and(
						eq(eventAttendee.eventId, eventId as string),
						eq(eventAttendee.userId, authorId),
						eq(eventAttendee.status, "CONFIRMED"),
					),
				)
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

			const bustEntityId = userId || clubId || eventId;
			if (bustEntityId) {
				await bustReviewCache(body.type.toLowerCase(), bustEntityId);
			}

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

		const bustEntityId = userId || clubId || eventId;
		if (bustEntityId) {
			await bustReviewCache(type.toLowerCase(), bustEntityId);
		}

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
			// Redis-backed + real-client-IP keyed, same as the router default — the router's
			// fallback store is a per-process Map keyed on x-forwarded-for alone, which lumps
			// all SSR traffic into one shared bucket.
			store: redisRateLimitStore,
			keyGenerator: rateLimitKey,
		},
		schema: {
			tags: ["Reviews"],
			summary: "Create or update a review",
			description:
				"Leave a review for a user, club, or event. If you've already reviewed this entity, your previous review will be replaced. Event reviews require attendance and event completion.",
			body: createReviewBodySchema,
			mcpTool: true,
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

const updateReviewBodySchema = z.object({
	rating: z.number().int().min(1).max(5),
	content: z.string().min(1).max(5000),
});

reviewsRouter.patch(
	"/reviews/:id",
	async ({ params, body, response, context }) => {
		if (!context.user) {
			throw apiError.unauthorized("You must be logged in to edit a review");
		}

		const reviewId = params.id;
		if (!reviewId) {
			throw apiError.validation("Review ID is required");
		}

		const existing = await db.select().from(review).where(eq(review.id, reviewId)).limit(1);

		const existingReview =
			existing[0] ??
			(() => {
				throw apiError.notFound("Review");
			})();

		if (existingReview.authorId !== context.user.id) {
			throw apiError.forbidden("You can only edit your own reviews");
		}

		const sanitizedContent = sanitizeReviewContent(body.content);

		await db.insert(reviewEditHistory).values({
			id: crypto.randomUUID(),
			reviewId: existingReview.id,
			previousRating: existingReview.rating,
			previousContent: existingReview.content,
			editedBy: context.user.id,
			createdAt: new Date().toISOString(),
		});

		await db
			.update(review)
			.set({
				rating: body.rating,
				content: sanitizedContent,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(review.id, reviewId));

		const updated = await db.select().from(review).where(eq(review.id, reviewId)).limit(1);

		logger.emit({
			severityText: "info",
			body: "Review updated via PATCH",
			attributes: {
				review_id: reviewId,
				author_id: context.user.id,
				request_id: context.requestId,
			},
		});

		const updatedReview =
			updated[0] ??
			(() => {
				throw apiError.internal("Failed to retrieve updated review");
			})();

		const bustType = existingReview.type.toLowerCase();
		const bustEntityId = existingReview.userId || existingReview.clubId || existingReview.eventId;
		if (bustEntityId) {
			await bustReviewCache(bustType, bustEntityId);
		}

		return response.json({ review: updatedReview });
	},
	{
		auth: true,
		schema: {
			tags: ["Reviews"],
			summary: "Edit a review",
			description: "Edit your own review. Previous version is saved to edit history.",
			params: z.object({ id: z.string() }),
			body: updateReviewBodySchema,
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
			},
		},
	},
);

reviewsRouter.delete(
	"/reviews/:id",
	async ({ params, response, context }) => {
		if (!context.user) {
			throw apiError.unauthorized("You must be logged in to delete a review");
		}

		const reviewId = params.id;
		if (!reviewId) {
			throw apiError.validation("Review ID is required");
		}

		const existing = await db.select().from(review).where(eq(review.id, reviewId)).limit(1);

		const existingReview =
			existing[0] ??
			(() => {
				throw apiError.notFound("Review");
			})();

		if (existingReview.authorId !== context.user.id && !context.isAdmin) {
			throw apiError.forbidden("You can only delete your own reviews");
		}

		await db.delete(review).where(eq(review.id, reviewId));

		logger.emit({
			severityText: "info",
			body: "Review deleted",
			attributes: {
				review_id: reviewId,
				author_id: existingReview.authorId,
				deleted_by: context.user.id,
				is_admin_action: context.isAdmin,
				request_id: context.requestId,
			},
		});

		if (context.isAdmin) {
			const { posthog } = await import("../lib/posthog");
			posthog.capture({
				distinctId: context.user.id,
				event: "review_deleted_by_admin",
				properties: {
					review_id: reviewId,
					author_id: existingReview.authorId,
					admin_action: true,
				},
			});
		}

		const bustType = existingReview.type.toLowerCase();
		const bustEntityId = existingReview.userId || existingReview.clubId || existingReview.eventId;
		if (bustEntityId) {
			await bustReviewCache(bustType, bustEntityId);
		}

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Reviews"],
			summary: "Delete a review",
			description: "Delete your own review. Admins can delete any review.",
			params: z.object({ id: z.string() }),
			response: {
				200: z.object({ success: z.boolean() }),
			},
		},
	},
);

reviewsRouter.get(
	"/reviews/:id/history",
	async ({ params, response }) => {
		const reviewId = params.id;
		if (!reviewId) {
			throw apiError.validation("Review ID is required");
		}

		const existing = await db.select({ id: review.id }).from(review).where(eq(review.id, reviewId)).limit(1);

		if (!existing[0]) {
			throw apiError.notFound("Review");
		}

		const history = await db
			.select({
				previousRating: reviewEditHistory.previousRating,
				previousContent: reviewEditHistory.previousContent,
				createdAt: reviewEditHistory.createdAt,
				editedBy: {
					id: user.id,
					name: user.name,
				},
			})
			.from(reviewEditHistory)
			.innerJoin(user, eq(reviewEditHistory.editedBy, user.id))
			.where(eq(reviewEditHistory.reviewId, reviewId))
			.orderBy(desc(reviewEditHistory.createdAt));

		return response.json({ history });
	},
	{
		schema: {
			tags: ["Reviews"],
			summary: "Get review edit history",
			description: "Get the public edit history for a review.",
			params: z.object({ id: z.string() }),
			response: {
				200: z.object({
					history: z.array(
						z.object({
							previousRating: z.number(),
							previousContent: z.string(),
							createdAt: z.string(),
							editedBy: z.object({
								id: z.string(),
								name: z.string(),
							}),
						}),
					),
				}),
			},
		},
	},
);

export { reviewsRouter };
