import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import * as z from "zod";
import { clubMembership, user } from "../../drizzle/schema";
import { createClubDataLoader } from "../../lib/dataloader";
import { db } from "../../lib/db";
import { apiError } from "../../lib/errors";
import { Router, responseSchema } from "../../lib/router";
import { paginationQuerySchema, paginationResponseSchema } from "../../lib/schemas";

const adminUsersRouter = new Router();

const baseUserSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	slug: z.string().nullable(),
	image: z.string().nullable(),
	callsign: z.string().nullable(),
	role: z.string().nullable(),
	gear: z.array(z.unknown()).nullable(),
	banned: z.boolean().nullable(),
	banExpires: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

const baseClubMembershipSchema = z.object({
	id: z.string(),
	clubId: z.string(),
	userId: z.string(),
	role: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

adminUsersRouter.get(
	"/admin/users",
	async ({ query, response, context: _context }) => {
		const { page = 1, perPage = 25, search = "", sortBy = "createdAt", sortOrder = "desc" } = query || {};
		const offset = (page - 1) * perPage;

		const whereConditions = [];

		if (search) {
			whereConditions.push(
				or(
					ilike(user.name, `%${search}%`),
					ilike(user.email, `%${search}%`),
					ilike(user.callsign, `%${search}%`),
				),
			);
		}

		const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		let orderBy:
			| typeof user.name
			| typeof user.email
			| typeof user.callsign
			| typeof user.createdAt
			| ReturnType<typeof desc>;
		if (sortBy === "name") {
			orderBy = sortOrder === "desc" ? desc(user.name) : user.name;
		} else if (sortBy === "email") {
			orderBy = sortOrder === "desc" ? desc(user.email) : user.email;
		} else if (sortBy === "callsign") {
			orderBy = sortOrder === "desc" ? desc(user.callsign) : user.callsign;
		} else {
			orderBy = sortOrder === "desc" ? desc(user.createdAt) : user.createdAt;
		}

		const users = await db.select().from(user).where(where).orderBy(orderBy).limit(perPage).offset(offset);

		const clubLoader = createClubDataLoader();

		const memberships = await Promise.all(
			users.map(async (u) => {
				const userMemberships = await db
					.select({
						id: clubMembership.id,
						clubId: clubMembership.clubId,
						role: clubMembership.role,
					})
					.from(clubMembership)
					.where(eq(clubMembership.userId, u.id));

				const clubIds = userMemberships.map((m) => m.clubId);
				const clubsData = await clubLoader.loadMany(clubIds);

				const clubs = userMemberships.map((m) => ({
					...m,
					club: clubsData.get(m.clubId) || null,
				}));

				return {
					...u,
					gear: u.gear,
					clubMembership: clubs,
				};
			}),
		);

		const total = await db.select({ count: count() }).from(user).where(where);

		return response.json({
			users: memberships,
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
			summary: "List all users",
			description: "Admin endpoint to list all users with pagination, search, and sorting",
			query: paginationQuerySchema.extend({
				search: z.string().optional(),
				sortBy: z.enum(["name", "email", "callsign", "createdAt"]).optional(),
				sortOrder: z.enum(["asc", "desc"]).optional(),
			}),
			response: {
				200: z.object({
					users: z.array(
						baseUserSchema.extend({
							clubMembership: z.array(
								baseClubMembershipSchema.pick({ id: true, clubId: true, role: true }).extend({
									club: z.object({ name: z.string() }).nullable(),
								}),
							),
						}),
					),
					pagination: paginationResponseSchema,
				}),
				...responseSchema([401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

adminUsersRouter.get(
	"/admin/users/:id",
	async ({ params, response, context: _context }) => {
		const userId = params.id;
		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		const userData = await db.select().from(user).where(eq(user.id, userId)).limit(1);

		if (!userData[0]) {
			throw apiError.notFound("User");
		}

		const memberships = await db
			.select({
				id: clubMembership.id,
				clubId: clubMembership.clubId,
				role: clubMembership.role,
			})
			.from(clubMembership)
			.where(eq(clubMembership.userId, userId));

		const clubLoader = createClubDataLoader();
		const clubIds = memberships.map((m) => m.clubId);
		const clubsData = await clubLoader.loadMany(clubIds);

		const clubs = memberships.map((m) => ({
			...m,
			club: clubsData.get(m.clubId) || null,
		}));

		return response.json({
			...userData[0],
			gear: userData[0].gear,
			clubMembership: clubs,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Get user details",
			description: "Admin endpoint to get user details with club memberships",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: baseUserSchema.extend({
					clubMembership: z.array(
						baseClubMembershipSchema.pick({ id: true, clubId: true, role: true }).extend({
							club: z.object({ name: z.string() }).nullable(),
						}),
					),
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

export { adminUsersRouter };
