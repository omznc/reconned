import { apiError, Router, responseSchema } from "@reconned/router";
import { randomUUIDv7 } from "bun";
import { and, eq } from "drizzle-orm";
import * as z from "zod";
import { club, clubMembership, instagramPageSelection } from "../../drizzle/schema";
import { logClubAudit } from "../../lib/audit-logger";
import { requireClubManager } from "../../lib/club-access";
import { db } from "../../lib/db";
import { env } from "../../lib/env";
import {
	debugToken,
	exchangeCodeForToken,
	exchangeForLongLivedToken,
	GRAPH_API_VERSION,
	getInstagramBusinessAccount,
	getNonExpiringPageAccessToken,
	getUserPages,
} from "../../lib/instagram";
import { logger } from "../../lib/posthog";

const clubsInstagramRouter = new Router();

/**
 * Permissions asked for in the Facebook login dialog. `pages_show_list` is the
 * one that makes `/me/accounts` return anything — without it the Graph API
 * answers `{ data: [] }` rather than an error, which is indistinguishable from
 * "this person has no Pages" unless the granted scopes are inspected.
 */
const INSTAGRAM_SCOPES = ["pages_show_list", "instagram_basic", "pages_read_engagement"] as const;

/**
 * Error codes understood by the club information form
 * (`getInstagramErrorMessage` in club-info.form.tsx). Anything else falls back
 * to its generic message.
 */
const INSTAGRAM_ERROR_CODES = {
	NO_FACEBOOK_PAGES: "no_facebook_pages",
	PAGES_PERMISSION_DENIED: "pages_permission_denied",
	NO_INSTAGRAM_BUSINESS_ACCOUNT: "no_instagram_business_account",
	NOT_CONNECTED_TO_PAGE: "not_connected_to_instagram",
	MISSING_PARAMS: "missing_params",
	AUTH_FAILED: "auth_failed",
	CONNECTION_FAILED: "connection_failed",
	PAGE_NOT_FOUND: "page_not_found",
	PERSONAL_ACCOUNT: "personal_account",
} as const;

/**
 * Back to the club information page. No locale prefix — the web app's middleware
 * negotiates one (`localePrefix: "as-needed"`), so hardcoding one here would
 * override the visitor's own choice.
 */
function clubInformationUrl(clubId: string, params: Record<string, string>): string {
	const search = new URLSearchParams(params).toString();
	return `${env.FRONTEND_URL}/dashboard/${clubId}/club/information${search ? `?${search}` : ""}#instagram`;
}

async function isClubManager(clubId: string, userId: string): Promise<boolean> {
	const membership = await db
		.select({ role: clubMembership.role })
		.from(clubMembership)
		.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, userId)))
		.limit(1);

	const role = membership[0]?.role;
	return role === "MANAGER" || role === "CLUB_OWNER";
}

/**
 * Resolve a Facebook page to its Instagram Business Account and store the
 * connection on the club. Shared by the OAuth callback (single-page case) and
 * the explicit page-selection endpoint.
 */
async function connectPageToClub({
	clubId,
	pageId,
	accessToken,
	userId,
}: {
	clubId: string;
	pageId: string;
	accessToken: string;
	userId: string;
}): Promise<{ instagramUsername: string }> {
	const nonExpiringToken = await getNonExpiringPageAccessToken(accessToken, pageId);

	const igBusinessResponse = await getInstagramBusinessAccount(pageId, nonExpiringToken);

	if (!igBusinessResponse?.instagram_business_account?.id) {
		// Covers both "personal account" and "no business account" — the Graph API
		// does not distinguish them on this endpoint.
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

	await logClubAudit({
		clubId,
		actionType: "INSTAGRAM_CONNECT",
		actionData: {
			instagramUsername: igBusinessResponse.instagram_business_account.username,
			pageId,
		},
		userId,
	});

	return { instagramUsername: igBusinessResponse.instagram_business_account.username };
}

/**
 * Facebook OAuth redirect target. The URL is baked into the Facebook app
 * configuration and into `exchangeCodeForToken`'s `redirect_uri`, so the path
 * (`/api/club/instagram/callback`, singular `club`) must not change.
 *
 * `auth: false` because this is a top-level browser navigation coming from
 * facebook.com; the session cookie still rides along (SameSite=Lax on a GET
 * navigation), and `context.user` is checked by hand below. Every failure is a
 * redirect rather than a JSON error — the visitor is a browser, not a client.
 */
clubsInstagramRouter.get(
	"/club/instagram/callback",
	async ({ query, response, context }) => {
		const clubId = query.clubId || query.state;
		const oauthError = query.error;

		if (!clubId) {
			// Without a club there is nowhere sensible to go back to.
			return response.redirect(`${env.FRONTEND_URL}/dashboard`);
		}

		if (oauthError) {
			return response.redirect(clubInformationUrl(clubId, { instagramError: oauthError }));
		}

		if (!context.user) {
			return response.redirect(
				`${env.FRONTEND_URL}/login?redirectTo=${encodeURIComponent(`/dashboard/${clubId}/club/information`)}`,
			);
		}

		if (!(await isClubManager(clubId, context.user.id))) {
			return response.redirect(clubInformationUrl(clubId, { instagramError: INSTAGRAM_ERROR_CODES.AUTH_FAILED }));
		}

		const code = query.code;
		if (!code) {
			return response.redirect(
				clubInformationUrl(clubId, { instagramError: INSTAGRAM_ERROR_CODES.MISSING_PARAMS }),
			);
		}

		let pages: Awaited<ReturnType<typeof getUserPages>>["data"];
		let userAccessToken: string;
		let grantedScopes: string[] = [];

		try {
			const shortLivedToken = await exchangeCodeForToken(code);
			const longLivedToken = await exchangeForLongLivedToken(shortLivedToken.access_token);
			userAccessToken = longLivedToken.access_token;

			// What the visitor actually agreed to, which is not necessarily what we asked
			// for: declining a permission in the dialog still yields a valid token.
			grantedScopes = (await debugToken(userAccessToken)).data.scopes ?? [];

			pages = (await getUserPages(userAccessToken)).data;
		} catch (error) {
			logger.emit({
				severityText: "error",
				body: "Instagram OAuth callback failed",
				attributes: {
					club_id: clubId,
					error: error instanceof Error ? error.message : String(error),
					business: {
						operation: "instagram_oauth_callback",
						domain: "instagram_integration",
						error_type: "token_exchange_failed",
					},
				},
			});
			return response.redirect(clubInformationUrl(clubId, { instagramError: INSTAGRAM_ERROR_CODES.AUTH_FAILED }));
		}

		if (!pages || pages.length === 0) {
			const missingScopes = INSTAGRAM_SCOPES.filter((scope) => !grantedScopes.includes(scope));

			logger.emit({
				severityText: "warn",
				body: "Instagram OAuth returned no Facebook Pages",
				attributes: {
					club_id: clubId,
					granted_scopes: grantedScopes.join(",") || "none",
					missing_scopes: missingScopes.join(",") || "none",
					business: {
						operation: "instagram_oauth_callback",
						domain: "instagram_integration",
						error_type: missingScopes.length > 0 ? "missing_scopes" : "no_pages",
					},
				},
			});

			// An ungranted `pages_show_list` and an account with genuinely no Pages both
			// come back as an empty list, but only one of them is the visitor's to fix.
			return response.redirect(
				clubInformationUrl(clubId, {
					instagramError: missingScopes.includes("pages_show_list")
						? INSTAGRAM_ERROR_CODES.PAGES_PERMISSION_DENIED
						: INSTAGRAM_ERROR_CODES.NO_FACEBOOK_PAGES,
				}),
			);
		}

		const onlyPage = pages.length === 1 ? pages[0] : undefined;

		if (onlyPage) {
			try {
				await connectPageToClub({
					clubId,
					pageId: onlyPage.id,
					accessToken: userAccessToken,
					userId: context.user.id,
				});

				return response.redirect(clubInformationUrl(clubId, { instagramSuccess: "true" }));
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				let errorCode: string = INSTAGRAM_ERROR_CODES.CONNECTION_FAILED;

				if (message.includes("No Instagram Business Account")) {
					errorCode = INSTAGRAM_ERROR_CODES.NO_INSTAGRAM_BUSINESS_ACCOUNT;
				} else if (message.includes("not found")) {
					errorCode = INSTAGRAM_ERROR_CODES.PAGE_NOT_FOUND;
				}

				logger.emit({
					severityText: "error",
					body: "Instagram OAuth callback failed",
					attributes: {
						club_id: clubId,
						page_id: onlyPage.id,
						error: message,
						business: {
							operation: "instagram_oauth_callback",
							domain: "instagram_integration",
							error_type: "connect_failed",
						},
					},
				});

				return response.redirect(clubInformationUrl(clubId, { instagramError: errorCode }));
			}
		}

		// Multiple pages: park the token server-side and let the visitor pick one.
		const sessionId = randomUUIDv7();
		await db.insert(instagramPageSelection).values({
			id: sessionId,
			clubId,
			accessToken: userAccessToken,
			pages: JSON.stringify(pages),
			expiresAt: new Date(Date.now() + 1000 * 60 * 15).toISOString(), // 15 minutes
			createdAt: new Date().toISOString(),
		});

		return response.redirect(
			`${env.FRONTEND_URL}/dashboard/${clubId}/club/information/instagram?sessionId=${sessionId}`,
		);
	},
	{
		auth: false,
		schema: {
			tags: ["Clubs"],
			summary: "Instagram OAuth callback",
			description: "Facebook OAuth redirect target for connecting a club's Instagram account",
			query: z.object({
				code: z.string().optional(),
				state: z.string().optional(),
				clubId: z.string().optional(),
				error: z.string().optional(),
			}),
			response: {
				302: z.object({}),
			},
		},
	},
);

clubsInstagramRouter.get(
	"/clubs/:id/instagram/auth-url",
	async ({ params, response, context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		await requireClubManager(clubId, context.user.id);

		if (!env.FACEBOOK_APP_ID) {
			throw apiError.internal("Facebook App ID not configured");
		}

		const redirectUri = `${env.BETTER_AUTH_URL}/api/club/instagram/callback`;
		const authUrl = new URL(`https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`);
		authUrl.searchParams.set("client_id", env.FACEBOOK_APP_ID);
		authUrl.searchParams.set("redirect_uri", redirectUri);
		authUrl.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
		authUrl.searchParams.set("state", clubId);
		// Facebook silently omits permissions the user declined on a previous run and
		// hands back a token that simply sees no Pages. `rerequest` makes the dialog
		// ask again instead, which is the difference between a fixable prompt and a
		// dead end the visitor cannot get out of.
		authUrl.searchParams.set("auth_type", "rerequest");

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

		await requireClubManager(clubId, context.user.id);

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

		await requireClubManager(clubId, context.user.id);

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
					`https://graph.facebook.com/${GRAPH_API_VERSION}/debug_token?input_token=${clubRecord.instagramAccessToken}&access_token=${appAccessToken}`,
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
					`https://graph.facebook.com/${GRAPH_API_VERSION}/${clubRecord.facebookPageId}?fields=access_token&access_token=${clubRecord.instagramAccessToken}`,
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
				`https://graph.facebook.com/${GRAPH_API_VERSION}/debug_token?input_token=${clubRecord.instagramAccessToken}&access_token=${appAccessToken}`,
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
		await requireClubManager(clubId, context.user.id);

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
		await requireClubManager(clubId, context.user.id);

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
		await requireClubManager(clubId, context.user.id);

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
			if (session[0].clubId !== clubId) {
				throw apiError.forbidden("Session does not match club");
			}
			validAccessToken = session[0].accessToken;
		}

		if (!validAccessToken) {
			throw apiError.validation("Access token or session ID required");
		}

		await connectPageToClub({
			clubId,
			pageId,
			accessToken: validAccessToken,
			userId: context.user.id,
		});

		// Cleanup session if it was used
		if (sessionId) {
			await db.delete(instagramPageSelection).where(eq(instagramPageSelection.id, sessionId));
		}

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
				`https://graph.facebook.com/${GRAPH_API_VERSION}/${clubRecord.instagramBusinessId}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username&limit=${limit}&access_token=${clubRecord.instagramAccessToken}`,
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
