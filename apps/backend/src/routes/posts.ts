import { apiError, Router } from "@reconned/router";
import { randomUUIDv7 } from "bun";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { club, clubMembership, comment, post, postLike, user } from "../drizzle/schema";
import { db } from "../lib/db";
import { paginationQuerySchema } from "../lib/schemas";
import { getS3UploadUrl } from "../lib/storage";

const postsRouter = new Router();

const basePostSchema = createSelectSchema(post);
const baseCommentSchema = createSelectSchema(comment);

const postAuthorSchema = z.object({
	id: z.string(),
	slug: z.string().nullable(),
	name: z.string(),
	image: z.string().nullable(),
});

const clubInfoSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string().nullable(),
	logo: z.string().nullable(),
});

const postWithDetailsSchema = basePostSchema.extend({
	author: postAuthorSchema,
	club: clubInfoSchema.nullable(),
	likesCount: z.number(),
	commentsCount: z.number(),
	isLiked: z.boolean(),
});

const commentWithAuthorSchema = baseCommentSchema.extend({
	author: postAuthorSchema,
});

const createPostBodySchema = z.object({
	title: z.string().max(200).optional(),
	content: z.string().min(1),
	images: z.array(z.string()).optional(),
	clubId: z.string().optional(),
	isPublic: z.boolean().default(true),
});

const updatePostBodySchema = z.object({
	title: z.string().max(200).optional(),
	content: z.string().min(1).optional(),
	images: z.array(z.string()).optional(),
});

const createCommentBodySchema = z.object({
	content: z.string().min(1).max(1000),
});

postsRouter.get(
	"/posts/feed",
	async ({ response, context, query }) => {
		if (!context.user) {
			throw apiError.unauthorized();
		}

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;

		const postsData = await db
			.select({
				post: post,
				author: {
					id: user.id,
					slug: user.slug,
					name: user.name,
					image: user.image,
				},
				club: {
					id: club.id,
					name: club.name,
					slug: club.slug,
					logo: club.logo,
				},
			})
			.from(post)
			.innerJoin(user, eq(post.authorId, user.id))
			.leftJoin(club, eq(post.clubId, club.id))
			.where(eq(post.isPublic, true))
			.orderBy(desc(post.createdAt))
			.limit(perPage)
			.offset(offset);

		const postIds = postsData.map((p) => p.post.id);

		if (postIds.length === 0) {
			return response.json({ posts: [], page, perPage, total: 0 });
		}

		const [likesCounts, commentsCounts, userLikes] = await Promise.all([
			db
				.select({ postId: postLike.postId, count: count() })
				.from(postLike)
				.where(
					sql`${postLike.postId} IN (${sql.join(
						postIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				)
				.groupBy(postLike.postId),
			db
				.select({ postId: comment.postId, count: count() })
				.from(comment)
				.where(
					sql`${comment.postId} IN (${sql.join(
						postIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				)
				.groupBy(comment.postId),
			db
				.select({ postId: postLike.postId })
				.from(postLike)
				.where(
					and(
						eq(postLike.userId, context.user.id),
						sql`${postLike.postId} IN (${sql.join(
							postIds.map((id) => sql`${id}`),
							sql`, `,
						)})`,
					),
				),
		]);

		const likesCountMap = new Map(likesCounts.map((l) => [l.postId, Number(l.count)]));
		const commentsCountMap = new Map(commentsCounts.map((c) => [c.postId, Number(c.count)]));
		const userLikesSet = new Set(userLikes.map((l) => l.postId));

		const posts = postsData.map((p) => ({
			...p.post,
			author: p.author,
			club: p.club,
			likesCount: likesCountMap.get(p.post.id) || 0,
			commentsCount: commentsCountMap.get(p.post.id) || 0,
			isLiked: userLikesSet.has(p.post.id),
		}));

		const totalCount = await db.select({ count: count() }).from(post).where(eq(post.isPublic, true));

		return response.json({
			posts,
			page,
			perPage,
			total: Number(totalCount[0]?.count) || 0,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Posts"],
			summary: "Get global feed",
			description: "Get a global feed of public posts from all users",
			query: paginationQuerySchema,
			response: {
				200: z.object({
					posts: z.array(postWithDetailsSchema),
					page: z.number(),
					perPage: z.number(),
					total: z.number(),
				}),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

postsRouter.get(
	"/posts",
	async ({ response, context, query }) => {
		if (!context.user) {
			throw apiError.unauthorized();
		}

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;

		const postsData = await db
			.select({
				post: post,
				author: {
					id: user.id,
					slug: user.slug,
					name: user.name,
					image: user.image,
				},
				club: {
					id: club.id,
					name: club.name,
					slug: club.slug,
					logo: club.logo,
				},
			})
			.from(post)
			.innerJoin(user, eq(post.authorId, user.id))
			.leftJoin(club, eq(post.clubId, club.id))
			.where(eq(post.authorId, context.user.id))
			.orderBy(desc(post.createdAt))
			.limit(perPage)
			.offset(offset);

		const postIds = postsData.map((p) => p.post.id);

		if (postIds.length === 0) {
			return response.json({ posts: [], page, perPage, total: 0 });
		}

		const [likesCounts, commentsCounts, userLikes] = await Promise.all([
			db
				.select({ postId: postLike.postId, count: count() })
				.from(postLike)
				.where(
					sql`${postLike.postId} IN (${sql.join(
						postIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				)
				.groupBy(postLike.postId),
			db
				.select({ postId: comment.postId, count: count() })
				.from(comment)
				.where(
					sql`${comment.postId} IN (${sql.join(
						postIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				)
				.groupBy(comment.postId),
			db
				.select({ postId: postLike.postId })
				.from(postLike)
				.where(
					and(
						eq(postLike.userId, context.user.id),
						sql`${postLike.postId} IN (${sql.join(
							postIds.map((id) => sql`${id}`),
							sql`, `,
						)})`,
					),
				),
		]);

		const likesCountMap = new Map(likesCounts.map((l) => [l.postId, Number(l.count)]));
		const commentsCountMap = new Map(commentsCounts.map((c) => [c.postId, Number(c.count)]));
		const userLikesSet = new Set(userLikes.map((l) => l.postId));

		const posts = postsData.map((p) => ({
			...p.post,
			author: p.author,
			club: p.club,
			likesCount: likesCountMap.get(p.post.id) || 0,
			commentsCount: commentsCountMap.get(p.post.id) || 0,
			isLiked: userLikesSet.has(p.post.id),
		}));

		const totalCount = await db.select({ count: count() }).from(post).where(eq(post.authorId, context.user.id));

		return response.json({
			posts,
			page,
			perPage,
			total: Number(totalCount[0]?.count) || 0,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Posts"],
			summary: "Get own posts",
			description: "Get current user's posts",
			query: paginationQuerySchema,
			response: {
				200: z.object({
					posts: z.array(postWithDetailsSchema),
					page: z.number(),
					perPage: z.number(),
					total: z.number(),
				}),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

postsRouter.get(
	"/users/:id/posts",
	async ({ response, context, params, query }) => {
		const userId = params.id;
		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;

		const targetUser = await db
			.select({ id: user.id, slug: user.slug, name: user.name, image: user.image, isPrivate: user.isPrivate })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		if (!targetUser[0]) {
			throw apiError.notFound("User not found");
		}

		const isOwnProfile = context.user?.id === userId;
		const isFollowing = false;

		if (targetUser[0].isPrivate && !isOwnProfile && !isFollowing) {
			return response.json({ posts: [], page, perPage, total: 0 });
		}

		const postsData = await db
			.select({
				post: post,
				author: {
					id: user.id,
					slug: user.slug,
					name: user.name,
					image: user.image,
				},
				club: {
					id: club.id,
					name: club.name,
					slug: club.slug,
					logo: club.logo,
				},
			})
			.from(post)
			.innerJoin(user, eq(post.authorId, user.id))
			.leftJoin(club, eq(post.clubId, club.id))
			.where(eq(post.authorId, userId))
			.orderBy(desc(post.createdAt))
			.limit(perPage)
			.offset(offset);

		const postIds = postsData.map((p) => p.post.id);

		let userLikesSet = new Set<string>();
		if (context.user?.id && postIds.length > 0) {
			const userLikes = await db
				.select({ postId: postLike.postId })
				.from(postLike)
				.where(
					and(
						eq(postLike.userId, context.user.id),
						sql`${postLike.postId} IN (${sql.join(
							postIds.map((id) => sql`${id}`),
							sql`, `,
						)})`,
					),
				);
			userLikesSet = new Set(userLikes.map((l) => l.postId));
		}

		const [likesCounts, commentsCounts] = await Promise.all([
			postIds.length > 0
				? db
						.select({ postId: postLike.postId, count: count() })
						.from(postLike)
						.where(
							sql`${postLike.postId} IN (${sql.join(
								postIds.map((id) => sql`${id}`),
								sql`, `,
							)})`,
						)
						.groupBy(postLike.postId)
				: Promise.resolve([]),
			postIds.length > 0
				? db
						.select({ postId: comment.postId, count: count() })
						.from(comment)
						.where(
							sql`${comment.postId} IN (${sql.join(
								postIds.map((id) => sql`${id}`),
								sql`, `,
							)})`,
						)
						.groupBy(comment.postId)
				: Promise.resolve([]),
		]);

		const likesCountMap = new Map(likesCounts.map((l) => [l.postId, Number(l.count)]));
		const commentsCountMap = new Map(commentsCounts.map((c) => [c.postId, Number(c.count)]));

		const posts = postsData.map((p) => ({
			...p.post,
			author: p.author,
			club: p.club,
			likesCount: likesCountMap.get(p.post.id) || 0,
			commentsCount: commentsCountMap.get(p.post.id) || 0,
			isLiked: userLikesSet.has(p.post.id),
		}));

		const totalCount = await db.select({ count: count() }).from(post).where(eq(post.authorId, userId));

		return response.json({
			posts,
			page,
			perPage,
			total: Number(totalCount[0]?.count) || 0,
		});
	},
	{
		auth: false,
		schema: {
			tags: ["Posts"],
			summary: "Get user posts",
			description: "Get posts for a specific user",
			params: z.object({ id: z.string() }),
			query: paginationQuerySchema,
			response: {
				200: z.object({
					posts: z.array(postWithDetailsSchema),
					page: z.number(),
					perPage: z.number(),
					total: z.number(),
				}),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

postsRouter.get(
	"/posts/:id",
	async ({ response, context, params }) => {
		const postId = params.id;
		if (!postId) {
			throw apiError.validation("Post ID is required");
		}

		const postData = await db
			.select({
				post: post,
				author: {
					id: user.id,
					slug: user.slug,
					name: user.name,
					image: user.image,
				},
				club: {
					id: club.id,
					name: club.name,
					slug: club.slug,
					logo: club.logo,
				},
			})
			.from(post)
			.innerJoin(user, eq(post.authorId, user.id))
			.leftJoin(club, eq(post.clubId, club.id))
			.where(eq(post.id, postId))
			.limit(1);

		if (!postData[0]) {
			throw apiError.notFound("Post not found");
		}

		const postRecord = postData[0].post;

		if (!postRecord.isPublic && postRecord.authorId !== context.user?.id) {
			if (postRecord.clubId) {
				const membership = await db
					.select()
					.from(clubMembership)
					.where(
						and(
							eq(clubMembership.clubId, postRecord.clubId),
							eq(clubMembership.userId, context.user?.id || ""),
						),
					)
					.limit(1);
				if (!membership[0]) {
					throw apiError.forbidden("This post is not public");
				}
			} else {
				throw apiError.forbidden("This post is not public");
			}
		}

		const [likesCount, commentsCount, userLike] = await Promise.all([
			db.select({ count: count() }).from(postLike).where(eq(postLike.postId, postId)),
			db.select({ count: count() }).from(comment).where(eq(comment.postId, postId)),
			context.user
				? db
						.select()
						.from(postLike)
						.where(and(eq(postLike.postId, postId), eq(postLike.userId, context.user.id)))
						.limit(1)
				: { length: 0 },
		]);

		return response.json({
			...postRecord,
			author: postData[0].author,
			club: postData[0].club,
			likesCount: Number(likesCount[0]?.count) || 0,
			commentsCount: Number(commentsCount[0]?.count) || 0,
			isLiked: userLike.length > 0,
		});
	},
	{
		auth: false,
		schema: {
			tags: ["Posts"],
			summary: "Get single post",
			description: "Get a single post by ID",
			params: z.object({ id: z.string() }),
			response: {
				200: postWithDetailsSchema,
				404: z.object({ error: z.string() }),
			},
		},
	},
);

postsRouter.post(
	"/posts",
	async ({ response, context, body }) => {
		if (!context.user) {
			throw apiError.unauthorized();
		}

		const { title, content, images, clubId, isPublic = true } = body;

		if (clubId) {
			const membership = await db
				.select()
				.from(clubMembership)
				.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
				.limit(1);

			if (!membership[0]) {
				throw apiError.forbidden("You must be a member of the club to post");
			}
		}

		const now = new Date().toISOString();
		const imagesArray = Array.isArray(images) ? images : [];
		const newPost = await db
			.insert(post)
			.values({
				id: randomUUIDv7(),
				title: title || null,
				content,
				images: imagesArray,
				authorId: context.user.id,
				clubId: clubId || null,
				isPublic,
				updatedAt: now,
			})
			.returning();

		if (!newPost[0]) {
			throw apiError.internal("Failed to create post");
		}
		return response.json({ post: newPost[0] }, 201);
	},
	{
		auth: true,
		schema: {
			tags: ["Posts"],
			summary: "Create post",
			description: "Create a new user post",
			body: createPostBodySchema,
			response: {
				201: z.object({ post: basePostSchema }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

postsRouter.put(
	"/posts/:id",
	async ({ response, context, params, body }) => {
		if (!context.user) {
			throw apiError.unauthorized();
		}

		const postId = params.id;
		if (!postId) {
			throw apiError.validation("Post ID is required");
		}

		const existingPost = await db.select().from(post).where(eq(post.id, postId)).limit(1);

		if (!existingPost[0]) {
			throw apiError.notFound("Post not found");
		}

		if (existingPost[0].authorId !== context.user.id) {
			throw apiError.forbidden("You can only edit your own posts");
		}

		const { title, content, images } = body;

		const updatedPost = await db
			.update(post)
			.set({
				title: title !== undefined ? title : existingPost[0].title,
				content: content !== undefined ? content : existingPost[0].content,
				images: images !== undefined ? images : existingPost[0].images,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(post.id, postId))
			.returning();

		if (!updatedPost[0]) {
			throw apiError.internal("Failed to update post");
		}
		return response.json({ post: updatedPost[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Posts"],
			summary: "Update post",
			description: "Update your own post",
			params: z.object({ id: z.string() }),
			body: updatePostBodySchema,
			response: {
				200: z.object({ post: basePostSchema }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

postsRouter.delete(
	"/posts/:id",
	async ({ response, context, params }) => {
		if (!context.user) {
			throw apiError.unauthorized();
		}

		const postId = params.id;
		if (!postId) {
			throw apiError.validation("Post ID is required");
		}

		const existingPost = await db.select().from(post).where(eq(post.id, postId)).limit(1);

		if (!existingPost[0]) {
			throw apiError.notFound("Post not found");
		}

		const isAuthor = existingPost[0].authorId === context.user.id;
		let isClubManager = false;

		if (existingPost[0].clubId) {
			const clubId = existingPost[0].clubId;
			const membership = await db
				.select()
				.from(clubMembership)
				.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
				.limit(1);
			isClubManager = membership[0]?.role === "MANAGER" || membership[0]?.role === "CLUB_OWNER";
		}

		if (!isAuthor && !isClubManager && !context.isAdmin) {
			throw apiError.forbidden("You can only delete your own posts or posts in your clubs");
		}

		await db.delete(post).where(eq(post.id, postId));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Posts"],
			summary: "Delete post",
			description: "Delete your own post or a post in your club",
			params: z.object({ id: z.string() }),
			response: {
				200: z.object({ success: z.boolean() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

postsRouter.post(
	"/posts/:id/like",
	async ({ response, context, params }) => {
		if (!context.user) {
			throw apiError.unauthorized();
		}

		const postId = params.id;
		if (!postId) {
			throw apiError.validation("Post ID is required");
		}

		const existingPost = await db.select().from(post).where(eq(post.id, postId)).limit(1);

		if (!existingPost[0]) {
			throw apiError.notFound("Post not found");
		}

		const existingLike = await db
			.select()
			.from(postLike)
			.where(and(eq(postLike.postId, postId), eq(postLike.userId, context.user.id)))
			.limit(1);

		if (existingLike[0]) {
			await db.delete(postLike).where(and(eq(postLike.postId, postId), eq(postLike.userId, context.user.id)));
			return response.json({ liked: false });
		}

		await db.insert(postLike).values({
			postId,
			userId: context.user.id,
		});

		return response.json({ liked: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Posts"],
			summary: "Toggle like",
			description: "Like or unlike a post",
			params: z.object({ id: z.string() }),
			response: {
				200: z.object({ liked: z.boolean() }),
				401: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

postsRouter.get(
	"/posts/:id/comments",
	async ({ response, params, query }) => {
		const postId = params.id;
		if (!postId) {
			throw apiError.validation("Post ID is required");
		}

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;

		const existingPost = await db.select().from(post).where(eq(post.id, postId)).limit(1);

		if (!existingPost[0]) {
			throw apiError.notFound("Post not found");
		}

		const commentsData = await db
			.select({
				comment: comment,
				author: {
					id: user.id,
					slug: user.slug,
					name: user.name,
					image: user.image,
				},
			})
			.from(comment)
			.innerJoin(user, eq(comment.authorId, user.id))
			.where(eq(comment.postId, postId))
			.orderBy(desc(comment.createdAt))
			.limit(perPage)
			.offset(offset);

		const comments = commentsData.map((c) => ({
			...c.comment,
			author: c.author,
		}));

		const totalCount = await db.select({ count: count() }).from(comment).where(eq(comment.postId, postId));

		return response.json({
			comments,
			page,
			perPage,
			total: Number(totalCount[0]?.count) || 0,
		});
	},
	{
		auth: false,
		schema: {
			tags: ["Posts"],
			summary: "Get comments",
			description: "Get comments for a post",
			params: z.object({ id: z.string() }),
			query: paginationQuerySchema,
			response: {
				200: z.object({
					comments: z.array(commentWithAuthorSchema),
					page: z.number(),
					perPage: z.number(),
					total: z.number(),
				}),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

postsRouter.post(
	"/posts/:id/comments",
	async ({ response, context, params, body }) => {
		if (!context.user) {
			throw apiError.unauthorized();
		}

		const postId = params.id;
		if (!postId) {
			throw apiError.validation("Post ID is required");
		}

		const existingPost = await db.select().from(post).where(eq(post.id, postId)).limit(1);

		if (!existingPost[0]) {
			throw apiError.notFound("Post not found");
		}

		const { content } = body;
		const now = new Date().toISOString();

		const newComment = await db
			.insert(comment)
			.values({
				id: randomUUIDv7(),
				postId,
				authorId: context.user.id,
				content,
				updatedAt: now,
			})
			.returning();

		const author = await db
			.select({
				id: user.id,
				slug: user.slug,
				name: user.name,
				image: user.image,
			})
			.from(user)
			.where(eq(user.id, context.user.id))
			.limit(1);

		if (!author[0]) {
			throw apiError.internal("Failed to fetch user");
		}
		const createdComment = newComment[0];
		if (!createdComment) {
			throw apiError.internal("Failed to create comment");
		}
		return response.json(
			{
				id: createdComment.id,
				postId: createdComment.postId,
				authorId: createdComment.authorId,
				content: createdComment.content,
				createdAt: createdComment.createdAt,
				updatedAt: createdComment.updatedAt,
				author: author[0],
			},
			201,
		);
	},
	{
		auth: true,
		schema: {
			tags: ["Posts"],
			summary: "Add comment",
			description: "Add a comment to a post",
			params: z.object({ id: z.string() }),
			body: createCommentBodySchema,
			response: {
				201: commentWithAuthorSchema,
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

postsRouter.delete(
	"/posts/:postId/comments/:commentId",
	async ({ response, context, params }) => {
		if (!context.user) {
			throw apiError.unauthorized();
		}

		const { postId, commentId } = params;

		if (!postId || !commentId) {
			throw apiError.validation("Post ID and Comment ID are required");
		}

		const existingComment = await db
			.select()
			.from(comment)
			.where(and(eq(comment.id, commentId), eq(comment.postId, postId)))
			.limit(1);

		if (!existingComment[0]) {
			throw apiError.notFound("Comment not found");
		}

		if (existingComment[0].authorId !== context.user.id && !context.isAdmin) {
			throw apiError.forbidden("You can only delete your own comments");
		}

		await db.delete(comment).where(eq(comment.id, commentId));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Posts"],
			summary: "Delete comment",
			description: "Delete your own comment",
			params: z.object({ postId: z.string(), commentId: z.string() }),
			response: {
				200: z.object({ success: z.boolean() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

postsRouter.post(
	"/posts/images/upload-url",
	async ({ response, context, body }) => {
		if (!context.user) {
			throw apiError.unauthorized();
		}

		const secureFilename = `${Date.now()}_${body.file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
		const key = `post-images/user/${context.user.id}/${secureFilename}`;

		try {
			const result = await getS3UploadUrl(key, body.file.type, body.file.size, context.user.id);
			return response.json(result);
		} catch (error) {
			throw apiError.internal(error instanceof Error ? error.message : "Failed to generate upload URL");
		}
	},
	{
		auth: true,
		schema: {
			tags: ["Posts"],
			summary: "Get post image upload URL",
			description: "Get a presigned S3 URL for uploading a user post image",
			body: z.object({
				file: z.object({
					name: z.string(),
					type: z.string(),
					size: z.number(),
				}),
			}),
			response: {
				200: z.object({
					url: z.string(),
					cdnUrl: z.string(),
					key: z.string(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

export { postsRouter };
