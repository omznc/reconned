import { apiError, Router, responseSchema } from "@reconned/router";
import { randomUUIDv7 } from "bun";
import { and, eq } from "drizzle-orm";
import * as z from "zod";
import { club, clubMembership, instagramPageSelection } from "../../drizzle/schema";
import { logClubAudit } from "../../lib/audit-logger";
import { db } from "../../lib/db";
import { env } from "../../lib/env";
import {
	debugToken,
	exchangeCodeForToken,
	exchangeForLongLivedToken,
	getInstagramBusinessAccount,
	getNonExpiringPageAccessToken,
	getUserPages,
} from "../../lib/instagram";
import { logger } from "../../lib/posthog";

const clubsInstagramRouter = new Router();

clubsInstagramRouter.get(
	"/clubs/:id/instagram/auth-url",
	async ({ params, response, context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select({ role: clubMembership.role })
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		if (!env.FACEBOOK_APP_ID) {
			throw apiError.internal("Facebook App ID not configured");
		}

		const redirectUri = `${env.BETTER_AUTH_URL}/api/club/instagram/callback`;
		const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
		authUrl.searchParams.set("client_id", env.FACEBOOK_APP_ID);
		authUrl.searchParams.set("redirect_uri", redirectUri);
		authUrl.searchParams.set("scope", "pages_show_list,instagram_basic,pages_read_engagement");
		authUrl.searchParams.set("state", clubId);

		return response.json({ authUrl: authUrl.toString() });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get Instagram authorization URL",
			description: "Get Instagram authorization URL for club",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					authUrl: z.string(),
				}),
				...responseSchema([400, 401, 403, 500], z.object({ error: z.string() })),
			},
		},
	},
);

clubsInstagramRouter.post(
	"/clubs/:id/instagram/disconnect",
	async ({ params, response, context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select({ role: clubMembership.role })
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		await db
			.update(club)
			.set({
				instagramAccessToken: null,
				instagramUsername: null,
				instagramConnected: false,
				instagramTokenExpiry: null,
				instagramBusinessId: null,
				facebookPageId: null,
				instagramTokenType: null,
				instagramRefreshToken: null,
				instagramProfilePictureUrl: null,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(club.id, clubId));

		await logClubAudit({
			clubId,
			actionType: "INSTAGRAM_DISCONNECT",
			actionData: {
				success: true,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Disconnect Instagram account",
			description: "Disconnect Instagram account from club",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

clubsInstagramRouter.get(
	"/clubs/:id/instagram/check-token",
	async ({ params, response, context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select({ role: clubMembership.role })
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const clubData = await db
			.select({
				instagramAccessToken: club.instagramAccessToken,
				instagramBusinessId: club.instagramBusinessId,
				instagramTokenExpiry: club.instagramTokenExpiry,
				facebookPageId: club.facebookPageId,
				instagramTokenType: club.instagramTokenType,
			})
			.from(club)
			.where(eq(club.id, clubId))
			.limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		const clubRecord = clubData[0];

		if (!clubRecord.instagramAccessToken || !clubRecord.instagramBusinessId) {
			return response.json({
				connected: false,
				igBusinessId: null,
				tokenType: null,
				expiresAt: null,
			});
		}

		if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) {
			throw apiError.internal("Facebook credentials not configured");
		}

		try {
			const appAccessToken = `${env.FACEBOOK_APP_ID}|${env.FACEBOOK_APP_SECRET}`;

			if (clubRecord.instagramTokenType === "PERMANENT") {
				const debugResponse = await fetch(
					`https://graph.facebook.com/v19.0/debug_token?input_token=${clubRecord.instagramAccessToken}&access_token=${appAccessToken}`,
				);

				if (!debugResponse.ok) {
					return response.json({
						connected: false,
						igBusinessId: null,
						tokenType: null,
						expiresAt: null,
					});
				}

				const debugData = (await debugResponse.json()) as {
					data?: { is_valid?: boolean };
				};

				if (!debugData.data?.is_valid) {
					return response.json({
						connected: false,
						igBusinessId: null,
						tokenType: null,
						expiresAt: null,
					});
				}

				return response.json({
					connected: true,
					igBusinessId: clubRecord.instagramBusinessId,
					tokenType: clubRecord.instagramTokenType ?? null,
					expiresAt: clubRecord.instagramTokenExpiry ?? null,
				});
			}

			const shouldRefreshToken =
				!clubRecord.instagramTokenExpiry ||
				new Date(clubRecord.instagramTokenExpiry) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

			if (shouldRefreshToken && clubRecord.facebookPageId) {
				const pageTokenResponse = await fetch(
					`https://graph.facebook.com/v19.0/${clubRecord.facebookPageId}?fields=access_token&access_token=${clubRecord.instagramAccessToken}`,
				);

				if (pageTokenResponse.ok) {
					const pageTokenData = (await pageTokenResponse.json()) as {
						access_token?: string;
					};
					const nonExpiringToken = pageTokenData.access_token;

					if (nonExpiringToken) {
						await db
							.update(club)
							.set({
								instagramAccessToken: nonExpiringToken,
								instagramTokenExpiry: null,
								instagramTokenType: "PERMANENT",
								updatedAt: new Date().toISOString(),
							})
							.where(eq(club.id, clubId));

						return response.json({
							connected: true,
							igBusinessId: clubRecord.instagramBusinessId,
							tokenType: "PERMANENT",
							expiresAt: null,
						});
					}
				}
			}

			const debugResponse = await fetch(
				`https://graph.facebook.com/v19.0/debug_token?input_token=${clubRecord.instagramAccessToken}&access_token=${appAccessToken}`,
			);

			if (!debugResponse.ok) {
				return response.json({
					connected: false,
					igBusinessId: null,
					tokenType: null,
					expiresAt: null,
				});
			}

			const debugData = (await debugResponse.json()) as {
				data?: { is_valid?: boolean; expires_at?: number };
			};

			if (!debugData.data?.is_valid) {
				return response.json({
					connected: false,
					igBusinessId: null,
					tokenType: null,
					expiresAt: null,
				});
			}

			if (debugData.data?.expires_at) {
				await db
					.update(club)
					.set({
						instagramTokenExpiry: new Date(debugData.data.expires_at * 1000).toISOString(),
						updatedAt: new Date().toISOString(),
					})
					.where(eq(club.id, clubId));
			}

			return response.json({
				connected: true,
				igBusinessId: clubRecord.instagramBusinessId,
				tokenType: clubRecord.instagramTokenType ?? null,
				expiresAt: clubRecord.instagramTokenExpiry ?? null,
			});
		} catch {
			return response.json({
				connected: Boolean(clubRecord.instagramAccessToken && clubRecord.instagramBusinessId),
				igBusinessId: clubRecord.instagramBusinessId,
				tokenType: clubRecord.instagramTokenType ?? null,
				expiresAt: clubRecord.instagramTokenExpiry ?? null,
			});
		}
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Check and refresh Instagram token",
			description: "Check Instagram token validity and refresh if needed",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					connected: z.boolean(),
					igBusinessId: z.string().nullable(),
					tokenType: z.string().nullable(),
					expiresAt: z.string().nullable(),
				}),
				...responseSchema([400, 401, 403, 404, 500], z.object({ error: z.string() })),
			},
		},
	},
);

clubsInstagramRouter.post(
	"/clubs/:id/instagram/exchange-code",
	async ({ params, body, response, context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		// Check if user is manager or owner
		const managerMembershipData = await db
			.select({ role: clubMembership.role })
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const { code } = body;

		const shortLivedTokenResponse = await exchangeCodeForToken(code);
		const longLivedTokenResponse = await exchangeForLongLivedToken(shortLivedTokenResponse.access_token);
		const pagesResponse = await getUserPages(longLivedTokenResponse.access_token);

		if (!pagesResponse.data || pagesResponse.data.length === 0) {
			return response.json({
				outcome: "NO_PAGES",
				sessionId: null,
				pages: [],
				page: null,
				accessToken: null,
			});
		}

		if (pagesResponse.data.length === 1) {
			const page = pagesResponse.data[0];
			if (!page) {
				return response.json({
					outcome: "NO_PAGES",
					sessionId: null,
					pages: [],
					page: null,
					accessToken: null,
				});
			}

			// For single page, store token server-side and return session ID
			const sessionId = randomUUIDv7();
			await db.insert(instagramPageSelection).values({
				id: sessionId,
				clubId,
				accessToken: longLivedTokenResponse.access_token,
				pages: JSON.stringify([page]),
				expiresAt: new Date(Date.now() + 1000 * 60 * 15).toISOString(), // 15 minutes
				createdAt: new Date().toISOString(),
			});

			return response.json({
				outcome: "SINGLE_PAGE",
				sessionId,
				pages: [],
				page: { id: page.id, name: page.name },
				accessToken: null,
			});
		}

		// Multiple pages: store in DB and return session ID
		const sessionId = randomUUIDv7();
		await db.insert(instagramPageSelection).values({
			id: sessionId,
			clubId,
			accessToken: longLivedTokenResponse.access_token,
			pages: JSON.stringify(pagesResponse.data),
			expiresAt: new Date(Date.now() + 1000 * 60 * 15).toISOString(), // 15 minutes
			createdAt: new Date().toISOString(),
		});

		return response.json({
			outcome: "MULTIPLE_PAGES",
			sessionId,
			pages: pagesResponse.data.map((p) => ({ id: p.id, name: p.name })),
			page: null,
			accessToken: null,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Exchange Instagram auth code",
			description: "Exchange auth code for token and get pages",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				code: z.string(),
			}),
			response: {
				200: z.object({
					outcome: z.enum(["SINGLE_PAGE", "MULTIPLE_PAGES", "NO_PAGES"]),
					sessionId: z.string().nullable(),
					pages: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
					page: z.object({ id: z.string(), name: z.string() }).nullable(),
					accessToken: z.string().nullable(),
				}),
				...responseSchema([400, 401, 500], z.object({ error: z.string() })),
			},
		},
	},
);

clubsInstagramRouter.get(
	"/clubs/:id/instagram/page-selection",
	async ({ params, query, response, context }) => {
		const clubId = params.id;
		const sessionId = query.sessionId;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		if (!sessionId) {
			throw apiError.validation("Session ID is required");
		}

		// Check if user is manager or owner
		const managerMembershipData = await db
			.select({ role: clubMembership.role })
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		// Get session data
		const session = await db
			.select()
			.from(instagramPageSelection)
			.where(eq(instagramPageSelection.id, sessionId))
			.limit(1);

		if (!session[0]) {
			throw apiError.validation("Invalid or expired session");
		}

		// Check if session matches club
		if (session[0].clubId !== clubId) {
			throw apiError.forbidden("Session does not match club");
		}

		// Parse stored pages and enrich with Instagram Business Account info
		const pages = JSON.parse(session[0].pages);
		const enrichedPages = await Promise.all(
			pages.map(async (page: { id: string; name: string; access_token: string }) => {
				try {
					const igBusinessResponse = await getInstagramBusinessAccount(page.id, page.access_token);
					return {
						...page,
						instagram_business_account: igBusinessResponse?.instagram_business_account || null,
					};
				} catch {
					return {
						...page,
						instagram_business_account: null,
					};
				}
			}),
		);

		return response.json({
			pages: enrichedPages,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get Instagram page selection data",
			description: "Retrieve stored Facebook pages for Instagram connection",
			params: z.object({
				id: z.string(),
			}),
			query: z.object({
				sessionId: z.string(),
			}),
			response: {
				200: z.object({
					pages: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							access_token: z.string(),
							instagram_business_account: z
								.object({
									id: z.string(),
									username: z.string().optional(),
									profile_picture_url: z.string().optional(),
								})
								.nullable(),
						}),
					),
				}),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

clubsInstagramRouter.post(
	"/clubs/:id/instagram/select-page",
	async ({ params, body, response, context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		// Check if user is manager or owner
		const managerMembershipData = await db
			.select({ role: clubMembership.role })
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const { pageId, accessToken, sessionId } = body;

		let validAccessToken = accessToken;

		// If session ID provided, look up token
		if (sessionId && !accessToken) {
			const session = await db
				.select()
				.from(instagramPageSelection)
				.where(eq(instagramPageSelection.id, sessionId))
				.limit(1);

			if (!session[0]) {
				throw apiError.validation("Invalid or expired session");
			}
			validAccessToken = session[0].accessToken;
		}

		if (!validAccessToken) {
			throw apiError.validation("Access token or session ID required");
		}

		const nonExpiringToken = await getNonExpiringPageAccessToken(validAccessToken, pageId);

		// First check if the Instagram business account exists on the page
		const igBusinessResponse = await getInstagramBusinessAccount(pageId, nonExpiringToken);

		if (!igBusinessResponse?.instagram_business_account?.id) {
			// This covers both personal account and no business account cases reasonably well for the API
			// Frontend can differentiate error messages if needed based on additional info, but strict check here
			throw apiError.validation("No Instagram Business Account found connected to this Facebook Page.");
		}

		const tokenInfo = await debugToken(nonExpiringToken);
		const isPermanentToken = !tokenInfo.data.expires_at || tokenInfo.data.expires_at === 0;

		await db
			.update(club)
			.set({
				instagramUsername: igBusinessResponse.instagram_business_account.username,
				instagramProfilePictureUrl: igBusinessResponse.instagram_business_account.profile_picture_url,
				instagramAccessToken: nonExpiringToken,
				instagramConnected: true,
				instagramTokenExpiry: isPermanentToken
					? null
					: new Date((tokenInfo.data.expires_at || 0) * 1000).toISOString(),
				instagramBusinessId: igBusinessResponse.instagram_business_account.id,
				facebookPageId: pageId,
				instagramTokenType: isPermanentToken ? "PERMANENT" : "TEMPORARY",
				updatedAt: new Date().toISOString(),
			})
			.where(eq(club.id, clubId));

		// Cleanup session if it was used
		if (sessionId) {
			await db.delete(instagramPageSelection).where(eq(instagramPageSelection.id, sessionId));
		}

		await logClubAudit({
			clubId,
			actionType: "INSTAGRAM_CONNECT",
			actionData: {
				instagramUsername: igBusinessResponse.instagram_business_account.username,
				pageId,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Select Facebook Page for Instagram",
			description: "Connect selected Facebook Page and its Instagram Business Account",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				pageId: z.string(),
				accessToken: z.string().optional(),
				sessionId: z.string().optional(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				...responseSchema([400, 401, 500], z.object({ error: z.string() })),
			},
		},
	},
);

clubsInstagramRouter.get(
	"/clubs/:id/instagram/media",
	async ({ params, query, response }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club");
		}

		const clubRecord = clubData[0];

		if (!clubRecord.instagramAccessToken || !clubRecord.instagramBusinessId) {
			logger.emit({
				severityText: "error",
				body: "Instagram token error: Missing access token or business ID",
				attributes: {
					club_id: clubId,
					club_name: clubRecord.name,
					has_access_token: String(!!clubRecord.instagramAccessToken),
					has_business_id: String(!!clubRecord.instagramBusinessId),
					business: {
						operation: "fetch_instagram_media",
						domain: "instagram_integration",
						error_type: "missing_credentials",
					},
				},
			});
			return response.json({ media: [], username: null });
		}

		try {
			const limit = query.limit || 20;

			// Fetch Instagram media
			const mediaResponse = await fetch(
				`https://graph.facebook.com/v19.0/${clubRecord.instagramBusinessId}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username&limit=${limit}&access_token=${clubRecord.instagramAccessToken}`,
			);

			if (!mediaResponse.ok) {
				const errorText = await mediaResponse.text();
				logger.emit({
					severityText: "error",
					body: "Instagram API error",
					attributes: {
						club_id: clubId,
						club_name: clubRecord.name,
						status_code: mediaResponse.status.toString(),
						status_text: mediaResponse.statusText,
						error: errorText,
						instagram_business_id: clubRecord.instagramBusinessId,
						media_limit: limit,
						business: {
							operation: "fetch_instagram_media",
							domain: "instagram_integration",
							error_type: "api_error",
							provider: "facebook_graph_api",
						},
					},
				});
				return response.json({ media: [], username: null });
			}

			const mediaData = (await mediaResponse.json()) as {
				data?: Array<{
					id: string;
					caption: string | null;
					media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
					media_url: string;
					permalink: string;
					thumbnail_url?: string;
					timestamp: string;
					username: string;
				}>;
			};

			return response.json({
				media: mediaData.data || [],
				username: mediaData.data?.[0]?.username || clubRecord.instagramUsername || null,
			});
		} catch (error) {
			logger.emit({
				severityText: "error",
				body: "Instagram fetch error",
				attributes: {
					club_id: clubId,
					club_name: clubRecord.name,
					error: error instanceof Error ? error.message : String(error),
					error_type: error instanceof Error ? error.name : "Unknown",
					business: {
						operation: "fetch_instagram_media",
						domain: "instagram_integration",
						error_type: "fetch_error",
					},
				},
			});
			return response.json({ media: [], username: null });
		}
	},
	{
		cache: {
			key: "club:{id}:instagram",
			ttl: 600,
			swr: 3600,
			// Public media feed, identical for every caller.
			varyByUser: false,
		},
		schema: {
			tags: ["Clubs"],
			summary: "Get Instagram media",
			description: "Fetch Instagram photos for a club",
			params: z.object({
				id: z.string(),
			}),
			query: z.object({
				limit: z.coerce.number().optional(),
			}),
			response: {
				200: z.object({
					media: z.array(
						z.object({
							id: z.string(),
							caption: z.string().nullable().optional(),
							media_type: z.enum(["IMAGE", "VIDEO", "CAROUSEL_ALBUM"]),
							media_url: z.string(),
							permalink: z.string(),
							thumbnail_url: z.string().nullable().optional(),
							timestamp: z.string(),
							username: z.string().nullable().optional(),
						}),
					),
					username: z.string().nullable(),
				}),
			},
		},
	},
);

export { clubsInstagramRouter };
