import { desc, eq, and } from "drizzle-orm";
import * as z from "zod";
import { review, user, event, eventRegistrationToUser } from "../drizzle/schema";
import { db } from "../lib/db";
import { apiError } from "../lib/errors";
import { Router } from "../lib/router";
import { isFeatureEnabled } from "../lib/feature-flags";

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
			name: z.string(),
			image: z.string().nullable(),
		})
		.nullable(),
});

reviewsRouter.get(
	"/reviews/:type/:id",
	async ({ params, response }) => {
		const { type, id } = params;

		if (!type || !id) {
			throw apiError.validation("Type and ID are required");
		}

		const validTypes = ["user", "club", "event"];
		if (!validTypes.includes(type)) {
			throw apiError.validation("Invalid review type. Must be 'user', 'club', or 'event'");
		}

		// Build the where condition based on type
		let whereCondition: ReturnType<typeof eq>;
		switch (type) {
			case "user":
				whereCondition = eq(review.userId, id);
				break;
			case "club":
				whereCondition = eq(review.clubId, id);
				break;
			case "event":
				whereCondition = eq(review.eventId, id);
				break;
			default:
				throw apiError.validation("Invalid review type");
		}

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
					name: user.name,
					image: user.image,
					isPrivate: user.isPrivate,
				},
			})
			.from(review)
			.leftJoin(user, eq(review.authorId, user.id))
			.where(whereCondition)
			.orderBy(desc(review.createdAt));

		// Apply privacy sanitization to author info
		const sanitizedReviews = reviews.map((review) => ({
			...review,
			author: review.author
				? {
						id: review.author.id,
						// For reviews, show name regardless of privacy (they wrote public content)
						// But hide image if profile is private
						name: review.author.name,
						image: review.author.isPrivate ? null : review.author.image,
					}
				: null,
		}));

		return response.json({
			reviews: sanitizedReviews,
		});
	},
	{
		schema: {
			tags: ["Reviews"],
			summary: "Get reviews",
			description: "Get all reviews for a user, club, or event",
			params: z.object({
				type: z.enum(["user", "club", "event"]),
				id: z.string(),
			}),
			response: {
				200: z.object({
					reviews: z.array(reviewWithAuthorSchema),
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
			throw apiError.unauthorized("You must be logged in to leave a review");
		}

		const reviewsEnabled = await isFeatureEnabled("REVIEWS");
		if (!reviewsEnabled) {
			throw apiError.forbidden("Reviews are currently disabled");
		}

		const { type, rating, content, userId, clubId, eventId } = body;

		const authorId = context.user.id;

		// Validate entity ID is provided based on type
		if (type === "USER" && !userId) {
			throw apiError.validation("userId is required for user reviews");
		}
		if (type === "CLUB" && !clubId) {
			throw apiError.validation("clubId is required for club reviews");
		}
		if (type === "EVENT" && !eventId) {
			throw apiError.validation("eventId is required for event reviews");
		}

		// Can't review yourself
		if (type === "USER" && userId === authorId) {
			throw apiError.validation("You cannot review yourself");
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
				throw apiError.notFound("Event");
			}

			const eventData = eventRecord[0]!;

			// Check if event has finished
			if (new Date(eventData.dateEnd) > new Date()) {
				throw apiError.validation("You can only review events that have finished");
			}

			// Check if user was registered (attended or not)
			const registration = await db
				.select()
				.from(eventRegistrationToUser)
				.where(
					and(
						eq(eventRegistrationToUser.b, authorId),
						eq(eventRegistrationToUser.a, eventId as string),
					),
				)
				.limit(1);

			if (!registration.length) {
				throw apiError.forbidden("You can only review events you attended");
			}
		}

		// Create the review
		const newReview = {
			id: crypto.randomUUID(),
			type,
			rating,
			content,
			authorId,
			userId: (type === "USER" ? userId : null) as string | null,
			clubId: (type === "CLUB" ? clubId : null) as string | null,
			eventId: (type === "EVENT" ? eventId : null) as string | null,
			updatedAt: new Date().toISOString(),
		};

		await db.insert(review).values(newReview);

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
			summary: "Create a review",
			description: "Leave a review for a user, club, or event. Event reviews require attendance and event completion.",
			body: createReviewBodySchema,
			response: {
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
					}),
				}),
			},
		},
	},
);

export { reviewsRouter };
