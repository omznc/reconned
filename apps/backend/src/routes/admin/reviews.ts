import { apiError, Router, responseSchema } from "@reconned/router";
import { and, count, desc, eq } from "drizzle-orm";
import * as z from "zod";
import { club, event, review, reviewEditHistory, user } from "../../drizzle/schema";
import { db } from "../../lib/db";
import { posthog } from "../../lib/posthog";
import { paginationQuerySchema, paginationResponseSchema } from "../../lib/schemas";

const adminReviewsRouter = new Router();

const adminReviewSchema = z.object({
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
	target: z
		.object({
			id: z.string(),
			name: z.string(),
			slug: z.string().nullable(),
		})
		.nullable(),
	editCount: z.number(),
});

adminReviewsRouter.get(
	"/admin/reviews",
	async ({ query, response, context: _context }) => {
		const { page = 1, perPage = 25, type } = query || {};
		const offset = (page - 1) * perPage;

		const conditions = [];
		if (type) {
			conditions.push(eq(review.type, type));
		}
		const where = conditions.length > 0 ? and(...conditions) : undefined;

		const reviewsData = await db
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
				},
				editCount: count(reviewEditHistory.id),
			})
			.from(review)
			.leftJoin(user, eq(review.authorId, user.id))
			.leftJoin(reviewEditHistory, eq(review.id, reviewEditHistory.reviewId))
			.where(where)
			.groupBy(review.id, user.id)
			.orderBy(desc(review.createdAt))
			.limit(perPage)
			.offset(offset);

		const reviewsWithTargets = await Promise.all(
			reviewsData.map(async (r) => {
				let target: { id: string; name: string; slug: string | null } | null = null;

				if (r.type === "CLUB" && r.clubId) {
					const result = await db
						.select({ id: club.id, name: club.name, slug: club.slug })
						.from(club)
						.where(eq(club.id, r.clubId))
						.limit(1);
					if (result[0]) target = result[0];
				} else if (r.type === "EVENT" && r.eventId) {
					const result = await db
						.select({ id: event.id, name: event.name, slug: event.slug })
						.from(event)
						.where(eq(event.id, r.eventId))
						.limit(1);
					if (result[0]) target = result[0];
				} else if (r.type === "USER" && r.userId) {
					const result = await db
						.select({ id: user.id, name: user.name, slug: user.slug })
						.from(user)
						.where(eq(user.id, r.userId))
						.limit(1);
					if (result[0]) target = result[0];
				}

				return { ...r, target };
			}),
		);

		const total = await db.select({ count: count() }).from(review).where(where);

		return response.json({
			reviews: reviewsWithTargets,
			pagination: {
				page,
				perPage,
				total: total[0]?.count || 0,
				totalPages: Math.ceil((total[0]?.count || 0) / perPage),
			},
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "List all reviews",
			description: "Admin endpoint to list all reviews with pagination and type filtering",
			query: paginationQuerySchema.extend({
				type: z.enum(["USER", "CLUB", "EVENT"]).optional(),
			}),
			response: {
				200: z.object({
					reviews: z.array(adminReviewSchema),
					pagination: paginationResponseSchema,
				}),
				...responseSchema([401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

adminReviewsRouter.delete(
	"/admin/reviews/:id",
	async ({ params, response, context }) => {
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

		await db.delete(review).where(eq(review.id, reviewId));

		posthog.capture({
			distinctId: context.user.id,
			event: "review_deleted_by_admin",
			properties: {
				review_id: reviewId,
				author_id: existingReview.authorId,
				admin_action: true,
			},
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Delete review",
			description: "Admin endpoint to delete a review",
			params: z.object({ id: z.string() }),
			response: {
				200: z.object({ success: z.boolean() }),
				...responseSchema([401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

export { adminReviewsRouter };
