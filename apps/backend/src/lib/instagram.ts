import { apiError } from "@reconned/router";
import { env } from "../lib/env";
import { logger } from "./posthog";

/**
 * Meta retires a Graph API version roughly two years after release, and calls to
 * a retired one are silently served by whatever version Meta picks instead —
 * which is how behaviour changes without any code changing. Pinned here so the
 * whole integration moves in one step, and overridable so a version bump is a
 * deploy rather than a release.
 */
export const GRAPH_API_VERSION = env.FACEBOOK_GRAPH_API_VERSION ?? "v26.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

async function logExternalApiCall(
	operation: string,
	url: string,
	method: string,
	response: Response,
	durationMs: number,
	additionalContext?: Record<string, unknown>,
) {
	logger.emit({
		severityText: response.ok ? "info" : "error",
		body: `External API call: ${operation}`,
		attributes: {
			operation,
			url: url.replace(/access_token=[^&]+/, "access_token=REDACTED"),
			method,
			status_code: response.status,
			duration_ms: durationMs,
			success: response.ok,
			...additionalContext,
		},
	});
}

export interface InstagramMedia {
	id: string;
	caption: string | null;
	media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
	media_url: string;
	permalink: string;
	thumbnail_url?: string;
	timestamp: string;
	username: string;
}

interface FacebookAuthResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
}

interface InstagramMediaResponse {
	data: InstagramMedia[];
	paging?: {
		cursors: {
			before: string;
			after: string;
		};
		next?: string;
	};
}

interface FacebookPageResponse {
	data: Array<{
		id: string;
		name: string;
		access_token: string;
	}>;
}

interface FacebookLongLivedTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number; // Typically ~5,184,000 seconds (60 days)
}

interface FacebookDebugTokenResponse {
	data: {
		app_id: string;
		type: string;
		application: string;
		data_access_expires_at: number;
		expires_at: number | null; // null for never-expiring tokens
		is_valid: boolean;
		scopes: string[];
		user_id: string;
	};
}

/**
 * Exchange Facebook authorization code for a short-lived access token
 */
export async function exchangeCodeForToken(code: string): Promise<FacebookAuthResponse> {
	// The redirect_uri must match exactly what was used in the auth dialog
	const redirectUri = `${env.BETTER_AUTH_URL}/api/club/instagram/callback`;
	const url = `${GRAPH_API_BASE}/oauth/access_token`;

	const startTime = Date.now();
	const response = await fetch(
		`${url}?client_id=${env.FACEBOOK_APP_ID}&client_secret=${
			env.FACEBOOK_APP_SECRET
		}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`,
	);
	const duration = Date.now() - startTime;

	await logExternalApiCall("exchange_code_for_token", url, "GET", response, duration, {
		has_code: Boolean(code),
	});

	if (!response.ok) {
		throw apiError.internal(`Failed to exchange code for token: ${await response.text()}`);
	}

	return (await response.json()) as FacebookAuthResponse;
}

/**
 * Exchange a short-lived user token for a long-lived user token
 */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<FacebookLongLivedTokenResponse> {
	const url = `${GRAPH_API_BASE}/oauth/access_token`;

	const startTime = Date.now();
	const response = await fetch(
		`${url}?grant_type=fb_exchange_token&client_id=${env.FACEBOOK_APP_ID}&client_secret=${env.FACEBOOK_APP_SECRET}&fb_exchange_token=${shortLivedToken}`,
	);
	const duration = Date.now() - startTime;

	await logExternalApiCall("exchange_for_long_lived_token", url, "GET", response, duration, {
		has_token: Boolean(shortLivedToken),
	});

	if (!response.ok) {
		throw apiError.internal(`Failed to exchange for long-lived token: ${await response.text()}`);
	}

	return (await response.json()) as FacebookLongLivedTokenResponse;
}

/**
 * Debug a Facebook token to check its validity and expiration
 */
export async function debugToken(accessToken: string): Promise<FacebookDebugTokenResponse> {
	const appAccessToken = `${env.FACEBOOK_APP_ID}|${env.FACEBOOK_APP_SECRET}`;
	const url = `${GRAPH_API_BASE}/debug_token`;

	const startTime = Date.now();
	const response = await fetch(`${url}?input_token=${accessToken}&access_token=${appAccessToken}`, {
		// Backend fetch caching if needed, but usually we want fresh data
		cache: "no-store",
	});
	const duration = Date.now() - startTime;

	await logExternalApiCall("debug_token", url, "GET", response, duration, {
		has_input_token: Boolean(accessToken),
	});

	if (!response.ok) {
		throw apiError.internal(`Failed to debug token: ${await response.text()}`);
	}

	return (await response.json()) as FacebookDebugTokenResponse;
}

/**
 * Get Facebook pages associated with a user
 */
export async function getUserPages(accessToken: string): Promise<FacebookPageResponse> {
	const url = `${GRAPH_API_BASE}/me/accounts`;

	const startTime = Date.now();
	const response = await fetch(`${url}?access_token=${accessToken}`);
	const duration = Date.now() - startTime;

	await logExternalApiCall("get_user_pages", url, "GET", response, duration, {
		has_access_token: Boolean(accessToken),
	});

	if (!response.ok) {
		throw apiError.internal(`Failed to get user pages: ${await response.text()}`);
	}

	const body = (await response.json()) as FacebookPageResponse;

	// An empty list is a 200, so it is invisible in the call log above — and it is
	// the single most common way this integration fails. Record enough to tell
	// "no Pages" apart from "Pages withheld" without ever logging a token.
	if (!body.data || body.data.length === 0) {
		logger.emit({
			severityText: "warn",
			body: "Facebook returned no Pages for this user",
			attributes: {
				graph_api_version: GRAPH_API_VERSION,
				response_keys: Object.keys(body).join(",") || "none",
				business: {
					operation: "get_user_pages",
					domain: "instagram_integration",
					error_type: "empty_page_list",
					provider: "facebook_graph_api",
				},
			},
		});
	}

	return body;
}

interface InstagramBusinessAccountResponse {
	instagram_business_account: {
		id: string;
		name?: string;
		username: string;
		profile_picture_url?: string;
	};
	id: string;
}

/**
 * Get Instagram Business Account connected to a Facebook Page
 */
export async function getInstagramBusinessAccount(
	pageId: string,
	pageAccessToken: string,
): Promise<InstagramBusinessAccountResponse | undefined> {
	const url = `${GRAPH_API_BASE}/${pageId}`;

	const startTime = Date.now();
	const response = await fetch(`${url}?fields=instagram_business_account&access_token=${pageAccessToken}`);
	const duration = Date.now() - startTime;

	await logExternalApiCall("get_instagram_business_account", url, "GET", response, duration, {
		page_id: pageId,
		has_access_token: Boolean(pageAccessToken),
	});

	if (response.ok) {
		const data = (await response.json()) as { instagram_business_account?: { id: string } };
		if (data.instagram_business_account?.id) {
			// Get Instagram details using the business account ID
			const igUrl = `${GRAPH_API_BASE}/${data.instagram_business_account.id}`;
			const igStartTime = Date.now();
			const igDetailsResponse = await fetch(
				`${igUrl}?fields=id,username,profile_picture_url&access_token=${pageAccessToken}`,
			);
			const igDuration = Date.now() - igStartTime;

			await logExternalApiCall("get_instagram_details", igUrl, "GET", igDetailsResponse, igDuration, {
				ig_business_id: data.instagram_business_account.id,
			});

			if (igDetailsResponse.ok) {
				const igDetails = (await igDetailsResponse.json()) as {
					username: string;
					profile_picture_url?: string;
				};

				return {
					id: pageId,
					instagram_business_account: {
						id: data.instagram_business_account.id,
						username: igDetails.username,
						profile_picture_url: igDetails.profile_picture_url,
					},
				};
			}
		}
	}

	return undefined;
}

/**
 * Get media from Instagram Business Account using the Graph API
 */
export async function getInstagramMedia(
	igBusinessId: string,
	accessToken: string,
	limit = 12,
): Promise<InstagramMediaResponse> {
	const url = `${GRAPH_API_BASE}/${igBusinessId}/media`;

	const startTime = Date.now();
	const response = await fetch(
		`${url}?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username&limit=${limit}&access_token=${accessToken}`,
	);
	const duration = Date.now() - startTime;

	await logExternalApiCall("get_instagram_media", url, "GET", response, duration, {
		ig_business_id: igBusinessId,
		media_limit: limit,
		has_access_token: Boolean(accessToken),
	});

	if (!response.ok) {
		throw apiError.internal(`Failed to get media: ${await response.text()}`);
	}

	return (await response.json()) as InstagramMediaResponse;
}

/**
 * Get a non-expiring page access token
 */
export async function getNonExpiringPageAccessToken(userAccessToken: string, pageId: string): Promise<string> {
	// Step 1: Get long-lived user access token (if not already?)
	// Note: The logic in original file handled both cases. Here we assume userAccessToken provided is valid (long-lived or short-lived).
	// If it's short-lived, exchange it first?
	// The original logic tried to check if it's already a page token.
	// Simplifying: we expect a user token here.

	// Check if token is already PAGE type
	try {
		const debugRes = await debugToken(userAccessToken);
		if (debugRes.data.type === "PAGE" && debugRes.data.is_valid) {
			return userAccessToken;
		}
	} catch {}

	// Step 2: Get pages with the token
	const pagesResponse = await getUserPages(userAccessToken);

	// Step 3: Find the requested page and return its access token
	const page = pagesResponse.data.find((p) => p.id === pageId);

	if (!page) {
		throw apiError.notFound(`Page with ID ${pageId} not found`);
	}

	// This page token is essentially non-expiring when obtained from a long-lived user token
	return page.access_token;
}
