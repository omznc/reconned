import { env } from "../lib/env";
import { apiError } from "../lib/errors";

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

	const response = await fetch(
		`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${env.FACEBOOK_APP_ID}&client_secret=${
			env.FACEBOOK_APP_SECRET
		}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`,
	);

	if (!response.ok) {
		throw apiError.internal(`Failed to exchange code for token: ${await response.text()}`);
	}

	return (await response.json()) as FacebookAuthResponse;
}

/**
 * Exchange a short-lived user token for a long-lived user token
 */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<FacebookLongLivedTokenResponse> {
	const response = await fetch(
		`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${env.FACEBOOK_APP_ID}&client_secret=${env.FACEBOOK_APP_SECRET}&fb_exchange_token=${shortLivedToken}`,
	);

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

	const response = await fetch(
		`https://graph.facebook.com/v19.0/debug_token?input_token=${accessToken}&access_token=${appAccessToken}`,
		{
			// Backend fetch caching if needed, but usually we want fresh data
			cache: "no-store",
		},
	);

	if (!response.ok) {
		throw apiError.internal(`Failed to debug token: ${await response.text()}`);
	}

	return (await response.json()) as FacebookDebugTokenResponse;
}

/**
 * Get Facebook pages associated with a user
 */
export async function getUserPages(accessToken: string): Promise<FacebookPageResponse> {
	const response = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`);

	if (!response.ok) {
		throw apiError.internal(`Failed to get user pages: ${await response.text()}`);
	}

	return (await response.json()) as FacebookPageResponse;
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
	const response = await fetch(
		`https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`,
	);

	if (response.ok) {
		const data = (await response.json()) as { instagram_business_account?: { id: string } };
		if (data.instagram_business_account?.id) {
			// Get Instagram details using the business account ID
			const igDetailsResponse = await fetch(
				`https://graph.facebook.com/v19.0/${data.instagram_business_account.id}?fields=id,username,profile_picture_url&access_token=${pageAccessToken}`,
			);

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
	const response = await fetch(
		`https://graph.facebook.com/v19.0/${igBusinessId}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username&limit=${limit}&access_token=${accessToken}`,
	);

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
