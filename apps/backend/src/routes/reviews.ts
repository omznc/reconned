import { desc, eq } from "drizzle-orm";
import * as z from "zod";
import { review, user } from "../drizzle/schema";
import { db } from "../lib/db";
import { apiError } from "../lib/errors";
import { Router } from "../lib/router";

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

export { reviewsRouter };
