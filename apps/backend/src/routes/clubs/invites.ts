import { render } from "@react-email/components";
import { apiError, Router } from "@reconned/router";
import { randomUUIDv7 } from "bun";
import { and, count, desc, eq, gt, ilike } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { club, clubInvite, clubMembership, user } from "../../drizzle/schema";
import ClubInvitationEmail from "../../emails/airsoft-invitation";
import { logClubAudit } from "../../lib/audit-logger";
import { bustRouteCache, clubMembershipCacheKeys } from "../../lib/cache-bust";
import {
	CLEAR_ARCHIVE,
	getActiveMembership,
	getMembershipIncludingArchived,
	requireClubManager,
} from "../../lib/club-access";
import { db } from "../../lib/db";
import { getEmailMessages, interpolateMessage } from "../../lib/email-messages";
import { env } from "../../lib/env";
import { isValidLanguage } from "../../lib/i18n";
import { sendEmail } from "../../lib/mail";
import { logger, posthog } from "../../lib/posthog";
import { paginationQuerySchema, paginationResponseSchema } from "../../lib/schemas";

const clubsInvitesRouter = new Router();

const baseClubInviteSchema = createSelectSchema(clubInvite);

clubsInvitesRouter.get(
	"/clubs/:id/invites",
	async ({ params, response, context, query }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		await requireClubManager(clubId, context.user.id);

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;

		const search = query?.search;
		const status = query?.status;

		const whereConditions = [eq(clubInvite.clubId, clubId)];

		if (status && ["PENDING", "ACCEPTED", "REJECTED", "EXPIRED", "REVOKED", "REQUESTED"].includes(status)) {
			whereConditions.push(
				eq(
					clubInvite.status,
					status as "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "REVOKED" | "REQUESTED",
				),
			);
		}

		if (search) {
			whereConditions.push(ilike(clubInvite.email, `%${search}%`));
		}

		const invites = await db
			.select({
				id: clubInvite.id,
				email: clubInvite.email,
				clubId: clubInvite.clubId,
				userId: clubInvite.userId,
				status: clubInvite.status,
				inviteCode: clubInvite.inviteCode,
				expiresAt: clubInvite.expiresAt,
				createdAt: clubInvite.createdAt,
				updatedAt: clubInvite.updatedAt,
				user: {
					id: user.id,
					name: user.name,
				},
			})
			.from(clubInvite)
			.leftJoin(user, eq(clubInvite.userId, user.id))
			.where(and(...whereConditions))
			.orderBy(desc(clubInvite.createdAt))
			.limit(perPage)
			.offset(offset);

		const totalData = await db
			.select({ count: count() })
			.from(clubInvite)
			.where(and(...whereConditions));

		const total = totalData[0]?.count || 0;

		return response.json({
			invites: invites.map((invite) => ({
				...invite,
				userName: invite.user?.name || null,
			})),
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
			summary: "Get club invites",
			description: "Get paginated invites for a club with search and status filtering",
			params: z.object({
				id: z.string(),
			}),
			query: paginationQuerySchema.extend({
				search: z.string().max(100).optional(),
				status: z.string().optional(),
			}),
			response: {
				200: z.object({
					invites: z.array(
						baseClubInviteSchema.extend({
							userName: z.string().nullable(),
						}),
					),
					pagination: paginationResponseSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsInvitesRouter.post(
	"/clubs/:id/invites",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const target = {
			email: body?.userEmail || context.user.email,
			name: body?.userName || context.user.name,
		};

		await requireClubManager(clubId, context.user.id);

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		const existingInvite = await db
			.select()
			.from(clubInvite)
			.where(
				and(
					eq(clubInvite.email, target.email),
					eq(clubInvite.clubId, clubId),
					eq(clubInvite.status, "PENDING"),
					gt(clubInvite.expiresAt, new Date().toISOString()),
				),
			)
			.limit(1);

		if (existingInvite[0]) {
			throw apiError.validation("Invitation already sent to this email");
		}

		const existingUser = await db
			.select({ id: user.id, language: user.language })
			.from(user)
			.where(eq(user.email, target.email))
			.limit(1);

		if (existingUser[0]) {
			const existingMembership = await getActiveMembership(clubId, existingUser[0].id);

			if (existingMembership) {
				throw apiError.validation("User is already a member of this club");
			}
		}

		const inviteCode = Math.random().toString(36).substring(2, 16).toUpperCase();
		const inviteId = crypto.randomUUID();
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

		const newInvite = await db
			.insert(clubInvite)
			.values({
				id: inviteId,
				email: target.email,
				clubId,
				status: "PENDING",
				inviteCode,
				expiresAt,
				userId: existingUser[0]?.id || null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.returning();

		if (!newInvite[0]) {
			throw apiError.internal("Failed to create invite");
		}

		await logClubAudit({
			clubId,
			actionType: "MEMBER_INVITE",
			actionData: {
				inviteId: newInvite[0].id,
				inviteCode: newInvite[0].inviteCode,
				email: newInvite[0].email,
				userName: target.name,
				existingUserId: existingUser[0]?.id,
			},
			userId: context.user.id,
		});

		const inviteUrl = `${env.BETTER_AUTH_URL}/api/club/member-invite/${newInvite[0].inviteCode}?redirectTo=${encodeURIComponent("/")}`;

		try {
			const language = isValidLanguage(existingUser[0]?.language) ? existingUser[0].language : "bs";
			const messages = getEmailMessages(language);

			await sendEmail({
				to: target.email,
				subject: interpolateMessage(messages.emails.clubInvitation.subject, { clubName: clubData[0].name }),
				html: await render(
					ClubInvitationEmail({
						code: newInvite[0].inviteCode,
						url: inviteUrl,
						name: target.name,
						clubLogo: clubData[0].logo || `${env.FRONTEND_URL}/logo.png`,
						clubName: clubData[0].name,
						clubLocation: clubData[0].location || "",
						language,
					}),
					{
						pretty: true,
					},
				),
			});

			// Track club invitation email
			posthog.capture({
				distinctId: context.user.id,
				event: "club_invitation_email_sent",
				properties: {
					club_id: clubId,
					club_name: clubData[0].name,
					language,
					is_existing_user: Boolean(existingUser[0]),
				},
			});
		} catch (error) {
			logger.emit({
				severityText: "error",
				body: "Failed to send invitation email",
				attributes: {
					error: error instanceof Error ? error.message : String(error),
					club_id: clubId,
					club_name: clubData[0]?.name,
					recipient_email: target.email,
					inviter_id: context.user.id,
					request_id: context.requestId,
					business: {
						operation: "send_invitation_email",
						domain: "club_management",
						recipient_is_existing_user: Boolean(existingUser[0]),
					},
				},
			});
		}

		return response.json({ success: true, invite: newInvite[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Send club invitation",
			description: "Create and send a club invitation",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				userEmail: z.email().or(z.literal("")).optional(),
				userName: z.string().optional(),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
					invite: baseClubInviteSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsInvitesRouter.put(
	"/clubs/:id/invites/:inviteId/revoke",
	async ({ params, response, context }) => {
		const clubId = params.id;
		const inviteId = params.inviteId;

		if (!clubId || !inviteId) {
			throw apiError.validation("Club ID and Invite ID are required");
		}

		await requireClubManager(clubId, context.user.id);

		const inviteData = await db
			.select()
			.from(clubInvite)
			.where(and(eq(clubInvite.id, inviteId), eq(clubInvite.clubId, clubId), eq(clubInvite.status, "PENDING")))
			.limit(1);

		if (!inviteData[0]) {
			throw apiError.notFound("Invite not found or already used");
		}

		const updatedInvite = await db
			.update(clubInvite)
			.set({
				status: "REVOKED",
				updatedAt: new Date().toISOString(),
			})
			.where(eq(clubInvite.id, inviteId))
			.returning();

		if (!updatedInvite[0]) {
			throw apiError.validation("Failed to revoke invite");
		}

		await logClubAudit({
			clubId,
			actionType: "MEMBER_INVITE",
			actionData: {
				inviteId,
				action: "revoke",
				email: updatedInvite[0].email,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Revoke club invitation",
			description: "Revoke a pending club invitation",
			params: z.object({
				id: z.string(),
				inviteId: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsInvitesRouter.get(
	"/clubs/:id/invites/count",
	async ({ params, response, query, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		await requireClubManager(clubId, context.user.id);

		const status = query?.status;
		const whereConditions = [eq(clubInvite.clubId, clubId)];

		if (status && ["PENDING", "ACCEPTED", "REJECTED", "EXPIRED", "REVOKED", "REQUESTED"].includes(status)) {
			whereConditions.push(
				eq(
					clubInvite.status,
					status as "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "REVOKED" | "REQUESTED",
				),
			);
		}

		const totalData = await db
			.select({ count: count() })
			.from(clubInvite)
			.where(and(...whereConditions));

		return response.json({ count: totalData[0]?.count || 0 });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Count club invites",
			description: "Get count of invites for a club with optional status filter",
			params: z.object({
				id: z.string(),
			}),
			query: z.object({
				status: z.string().optional(),
			}),
			response: {
				200: z.object({
					count: z.number(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsInvitesRouter.get(
	"/clubs/:id/invites/requests-count",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		await requireClubManager(clubId, context.user.id);

		const requestsData = await db
			.select({ count: count() })
			.from(clubInvite)
			.where(and(eq(clubInvite.clubId, clubId), eq(clubInvite.status, "REQUESTED")));

		return response.json({ count: requestsData[0]?.count || 0 });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get invite requests count",
			description: "Get count of invite requests (status REQUESTED) for a club",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					count: z.number(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsInvitesRouter.get(
	"/club/member-invite/:inviteCode",
	async ({ params, query, response, context }) => {
		const inviteCode = params.inviteCode;
		const redirectTo = (query.redirectTo as string) || "/";

		if (!inviteCode) {
			throw apiError.validation("Invite code is required");
		}

		// Find the invite
		const inviteData = await db
			.select({
				id: clubInvite.id,
				email: clubInvite.email,
				clubId: clubInvite.clubId,
				status: clubInvite.status,
				expiresAt: clubInvite.expiresAt,
				club: {
					name: club.name,
					slug: club.slug,
				},
			})
			.from(clubInvite)
			.innerJoin(club, eq(club.id, clubInvite.clubId))
			.where(and(eq(clubInvite.inviteCode, inviteCode), gt(clubInvite.expiresAt, new Date().toISOString())))
			.limit(1);

		if (!inviteData[0]) {
			throw apiError.notFound("Invite");
		}

		const invite = inviteData[0];

		if (invite.status !== "PENDING") {
			throw apiError.validation(`This invite has already been ${invite.status.toLowerCase()}`);
		}

		// If user is authenticated and email matches, redirect to accept
		if (context.user && context.user.email === invite.email) {
			return response.redirect(
				`${env.FRONTEND_URL}/clubs/${invite.club.slug}?invite=${inviteCode}&redirectTo=${encodeURIComponent(redirectTo)}`,
			);
		}

		// If user is authenticated but email doesn't match
		if (context.user) {
			throw apiError.forbidden("This invite is for a different email address");
		}

		// Redirect to signup/login with invite context
		return response.redirect(
			`${env.FRONTEND_URL}/register?invite=${inviteCode}&redirectTo=${encodeURIComponent(redirectTo)}`,
		);
	},
	{
		auth: false,
		schema: {
			summary: "Handle club member invite links",
			tags: ["Clubs"],
			query: z.object({
				redirectTo: z.string().optional(),
			}),
			response: {
				302: z.object({}), // Redirect
				400: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsInvitesRouter.post(
	"/club/member-invite/:inviteCode",
	async ({ params, query, response, context }) => {
		const inviteCode = params.inviteCode;
		const action = query.action as "approve" | "dismiss";

		if (!inviteCode) {
			throw apiError.validation("Invite code is required");
		}

		if (!action || !["approve", "dismiss"].includes(action)) {
			throw apiError.validation("Action must be 'approve' or 'dismiss'");
		}

		if (!context.user) {
			throw apiError.unauthorized("Authentication required");
		}

		// Find the invite
		const inviteData = await db
			.select()
			.from(clubInvite)
			.where(
				and(
					eq(clubInvite.inviteCode, inviteCode),
					eq(clubInvite.status, "PENDING"),
					gt(clubInvite.expiresAt, new Date().toISOString()),
				),
			)
			.limit(1);

		if (!inviteData[0]) {
			// Check if invite exists with different status or expired
			const anyInvite = await db.select().from(clubInvite).where(eq(clubInvite.inviteCode, inviteCode)).limit(1);

			if (!anyInvite[0]) {
				throw apiError.notFound("Invite");
			}

			if (anyInvite[0].status !== "PENDING") {
				throw apiError.validation(`This invite has already been ${anyInvite[0].status.toLowerCase()}`);
			}

			if (new Date(anyInvite[0].expiresAt) <= new Date()) {
				throw apiError.validation("This invite has expired");
			}

			throw apiError.notFound("Invite");
		}

		const invite = inviteData[0];

		// Verify the invite is for the current user
		if (invite.email !== context.user.email) {
			throw apiError.forbidden("This invite is not for you");
		}

		// Check if user already has a membership in this club
		const existingMembership = await getMembershipIncludingArchived(invite.clubId, context.user.id);

		if (existingMembership?.status === "ACTIVE") {
			throw apiError.validation("You are already a member of this club");
		}

		if (action === "approve") {
			// An archived membership is revived rather than re-inserted: (userId, clubId) is unique.
			if (existingMembership) {
				await db
					.update(clubMembership)
					.set({
						...CLEAR_ARCHIVE,
						role: "USER",
						startDate: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					})
					.where(eq(clubMembership.id, existingMembership.id));
			} else {
				await db.insert(clubMembership).values({
					id: randomUUIDv7(),
					userId: context.user.id,
					clubId: invite.clubId,
					role: "USER",
					startDate: new Date().toISOString(),
				});
			}

			// Update invite status
			await db
				.update(clubInvite)
				.set({
					status: "ACCEPTED",
					updatedAt: new Date().toISOString(),
				})
				.where(eq(clubInvite.id, invite.id));

			// Log the action
			await logClubAudit({
				clubId: invite.clubId,
				userId: context.user.id,
				actionType: "MEMBER_JOINED_VIA_INVITE",
				actionData: { inviteId: invite.id },
			});

			// This route is keyed by invite code, so `bustCache` can't reach the club it just
			// added a member to — the roster and member counts have to be dropped by hand.
			await bustRouteCache(clubMembershipCacheKeys(invite.clubId));
		} else {
			// Update invite status to rejected
			await db
				.update(clubInvite)
				.set({
					status: "REJECTED",
					updatedAt: new Date().toISOString(),
				})
				.where(eq(clubInvite.id, invite.id));
		}

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Accept or decline club invitation",
			description: "Accept or decline a club invitation using the invite code",
			params: z.object({
				inviteCode: z.string(),
			}),
			query: z.object({
				action: z.enum(["approve", "dismiss"]),
				redirectTo: z.string().optional(),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

export { clubsInvitesRouter };
