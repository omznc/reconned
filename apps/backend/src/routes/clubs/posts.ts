import { AppError, apiError, Router, responseSchema } from "@reconned/router";
import { and, count, desc, eq } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { club, post } from "../../drizzle/schema";
import { logClubAudit } from "../../lib/audit-logger";
import { getActiveMembership, isClubManager, requireClubManager } from "../../lib/club-access";
import { db } from "../../lib/db";
import { paginationQuerySchema, paginationResponseSchema } from "../../lib/schemas";
import { deleteS3Files, getS3UploadUrl } from "../../lib/storage";

const clubsPostsRouter = new Router();

const basePostSchema = createSelectSchema(post);

const createPostBodySchema = z.object({
	title: z.string().min(1).max(200),
	content: z.string(),
	images: z.array(z.url()).optional(),
	isPublic: z.boolean(),
});

clubsPostsRouter.get(
	"/clubs/:id/posts",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const clubData = await db.select({ isPrivate: club.isPrivate }).from(club).where(eq(club.id, clubId)).limit(1);
		const clubInfo = clubData[0];

		if (!clubInfo) {
			throw apiError.notFound("Club");
		}

		let isMember = false;
		let isManager = false;

		if (context.user?.id) {
			const membership = await getActiveMembership(clubId, context.user.id);
			isMember = !!membership;
			isManager = isClubManager(membership);
		}

		if (clubInfo.isPrivate && !isMember) {
			return response.json({ posts: [] });
		}

		const posts = await db
			.select()
			.from(post)
			.where(isManager ? eq(post.clubId, clubId) : and(eq(post.clubId, clubId), eq(post.isPublic, true)))
			.orderBy(desc(post.createdAt));

		return response.json({ posts });
	},
	{
		cache: {
			key: "club:{id}:posts",
			ttl: 300,
			swr: 1800,
			// Private clubs are membership-gated in the handler.
			varyByUser: true,
		},
		schema: {
			tags: ["Clubs"],
			summary: "Get club posts",
			description: "Get all posts for a club (private clubs: members only, public clubs: published posts)",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					posts: z.array(basePostSchema),
				}),
				400: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
			// Named explicitly: the generated name would collide with the by-ID route below,
			// and a collision silently drops one of the two tools.
			mcpTool: {
				name: "list_club_posts",
				description: "List all posts for a club (private clubs: members only, public clubs: published posts)",
			},
		},
	},
);

clubsPostsRouter.get(
	"/clubs/:id/posts/:postId",
	async ({ params, response, context }) => {
		const clubId = params.id;
		const postId = params.postId;

		if (!clubId || !postId) {
			throw apiError.validation("Club ID and Post ID are required");
		}

		await requireClubManager(clubId, context.user.id);

		const postData = await db
			.select()
			.from(post)
			.where(and(eq(post.id, postId), eq(post.clubId, clubId)))
			.limit(1);

		if (!postData[0]) {
			throw apiError.notFound("Post not found");
		}

		return response.json({ post: postData[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club post",
			description: "Get a specific post for a club",
			params: z.object({
				id: z.string(),
				postId: z.string(),
			}),
			response: {
				200: z.object({
					post: basePostSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
			mcpTool: true,
		},
	},
);

clubsPostsRouter.get(
	"/clubs/:id/posts/paginated",
	async ({ params, response, context, query }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		await requireClubManager(clubId, context.user.id);

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;

		const posts = await db
			.select()
			.from(post)
			.where(eq(post.clubId, clubId))
			.orderBy(desc(post.createdAt))
			.limit(perPage)
			.offset(offset);

		const totalData = await db.select({ count: count() }).from(post).where(eq(post.clubId, clubId));
		const total = totalData[0]?.count || 0;

		return response.json({
			posts,
			pagination: {
				page,
				perPage,
				total,
				totalPages: Math.ceil(total / perPage),
			},
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club posts",
			description: "Get all posts for a club with pagination",
			params: z.object({
				id: z.string(),
			}),
			query: paginationQuerySchema,
			response: {
				200: z.object({
					posts: z.array(basePostSchema),
					pagination: paginationResponseSchema,
				}),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

clubsPostsRouter.post(
	"/clubs/:id/posts",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		await requireClubManager(clubId, context.user.id);

		const postId = crypto.randomUUID();

		const newPost = await db
			.insert(post)
			.values({
				id: postId,
				clubId,
				title: body.title,
				content: body.content,
				images: body.images || [],
				isPublic: body.isPublic,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.returning();

		if (!newPost[0]) {
			throw apiError.validation("Failed to create post");
		}

		await logClubAudit({
			clubId,
			actionType: "POST_CREATE",
			actionData: {
				id: newPost[0].id,
				title: body.title,
				content: body.content,
				isPublic: body.isPublic,
				images: body.images || [],
			},
			userId: context.user.id,
		});

		return response.json({ success: true, post: newPost[0] });
	},
	{
		auth: true,
		bustCache: ["club:{id}"],
		schema: {
			tags: ["Clubs"],
			summary: "Create club post",
			description: "Create a new post for a club",
			params: z.object({
				id: z.string(),
			}),
			body: createPostBodySchema,
			response: {
				200: z.object({
					success: z.boolean(),
					post: basePostSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
			mcpTool: true,
		},
	},
);

clubsPostsRouter.put(
	"/clubs/:id/posts/:postId",
	async ({ params, response, context, body }) => {
		const clubId = params.id;
		const postId = params.postId;

		if (!clubId || !postId) {
			throw apiError.validation("Club ID and Post ID are required");
		}

		await requireClubManager(clubId, context.user.id);

		const existingPostData = await db
			.select()
			.from(post)
			.where(and(eq(post.id, postId), eq(post.clubId, clubId)))
			.limit(1);

		if (!existingPostData[0]) {
			throw apiError.notFound("Post not found");
		}

		const existingPost = existingPostData[0];
		let imagesToDelete: string[] = [];

		if (existingPost.images && existingPost.images.length > 0) {
			const newImages = body.images || [];
			imagesToDelete = existingPost.images.filter((url) => !newImages.includes(url));
		}

		const updatedPost = await db
			.update(post)
			.set({
				title: body.title,
				content: body.content,
				images: body.images || [],
				isPublic: body.isPublic,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(post.id, postId))
			.returning();

		if (!updatedPost[0]) {
			throw apiError.validation("Failed to update post");
		}

		if (imagesToDelete.length > 0) {
			const imageKeys = imagesToDelete.map((url) => {
				const urlObj = new URL(url);
				return urlObj.pathname.substring(1);
			});
			await deleteS3Files(imageKeys, context.user.id);
		}

		await logClubAudit({
			clubId,
			actionType: "POST_UPDATE",
			actionData: {
				id: updatedPost[0].id,
				title: body.title,
				content: body.content,
				isPublic: body.isPublic,
				images: body.images || [],
			},
			userId: context.user.id,
		});

		return response.json({ success: true, post: updatedPost[0] });
	},
	{
		auth: true,
		bustCache: ["club:{id}"],
		schema: {
			tags: ["Clubs"],
			summary: "Update club post",
			description: "Update an existing post for a club",
			params: z.object({
				id: z.string(),
				postId: z.string(),
			}),
			body: createPostBodySchema,
			response: {
				200: z.object({
					success: z.boolean(),
					post: basePostSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
			mcpTool: true,
		},
	},
);

clubsPostsRouter.delete(
	"/clubs/:id/posts/:postId",
	async ({ params, response, context }) => {
		const clubId = params.id;
		const postId = params.postId;

		if (!clubId || !postId) {
			throw apiError.validation("Club ID and Post ID are required");
		}

		await requireClubManager(clubId, context.user.id);

		const postData = await db
			.select()
			.from(post)
			.where(and(eq(post.id, postId), eq(post.clubId, clubId)))
			.limit(1);

		if (!postData[0]) {
			throw apiError.notFound("Post not found");
		}

		if (postData[0].images && postData[0].images.length > 0) {
			const imageKeys = postData[0].images.map((url) => {
				const urlObj = new URL(url);
				return urlObj.pathname.substring(1);
			});
			await deleteS3Files(imageKeys, context.user.id);
		}

		await db.delete(post).where(eq(post.id, postId));

		await logClubAudit({
			clubId,
			actionType: "POST_DELETE",
			actionData: {
				id: postId,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		bustCache: ["club:{id}"],
		schema: {
			tags: ["Clubs"],
			summary: "Delete club post",
			description: "Delete a post from a club",
			params: z.object({
				id: z.string(),
				postId: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
			mcpTool: true,
		},
	},
);

clubsPostsRouter.post(
	"/clubs/:id/posts/images/upload-url",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		await requireClubManager(clubId, context.user.id);

		const secureFilename = `${Date.now()}_${body.file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
		const key = `post-images/${clubId}/${secureFilename}`;

		try {
			const result = await getS3UploadUrl(key, body.file.type, body.file.size, context.user.id);
			return response.json(result);
		} catch (error) {
			if (error instanceof AppError) {
				throw error;
			}
			throw apiError.internal(error instanceof Error ? error.message : "Failed to generate upload URL");
		}
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get post image upload URL",
			description: "Get a presigned S3 URL for uploading a post image",
			params: z.object({
				id: z.string(),
			}),
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
				403: z.object({ error: z.string() }),
			},
		},
	},
);

export { clubsPostsRouter };
