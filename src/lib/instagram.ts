"use server";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

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

export interface FacebookAuthResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
}

export interface InstagramUserProfile {
	id: string;
	username: string;
	name?: string;
	profile_picture_url?: string;
}

export interface InstagramMediaResponse {
	data: InstagramMedia[];
	paging?: {
		cursors: {
			before: string;
			after: string;
		};
		next?: string;
	};
}

export interface FacebookPageResponse {
	data: Array<{
		id: string;
		name: string;
		access_token: string;
	}>;
}

export interface FacebookLongLivedTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number; // Typically ~5,184,000 seconds (60 days)
}

export interface FacebookDebugTokenResponse {
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

export interface SystemUserTokenResponse {
	access_token: string;
	token_type: string;
}

/**
 * Get the Facebook authorization URL for a specific club
 */
export async function getInstagramAuthUrl(clubId: string): Promise<string> {
	const baseUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
	const redirectUri = `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/api/club/instagram/callback`;

	const params = new URLSearchParams({
		client_id: env.FACEBOOK_APP_ID,
		redirect_uri: redirectUri,
		scope: "pages_show_list,instagram_basic,pages_read_engagement",
		state: clubId,
	});

	baseUrl.search = params.toString();
	return baseUrl.toString();
}

/**
 * Exchange Facebook authorization code for a short-lived access token
 */
export async function exchangeCodeForToken(
	code: string,
): Promise<FacebookAuthResponse> {
	const redirectUri = `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/api/club/instagram/callback`;

	const response = await fetch(
		`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${
			env.FACEBOOK_APP_ID
		}&client_secret=${
			env.FACEBOOK_APP_SECRET
		}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`,
	);

	if (!response.ok) {
		throw new Error(
			`Failed to exchange code for token: ${await response.text()}`,
		);
	}

	return await response.json();
}

/**
 * Exchange a short-lived user token for a long-lived user token
 */
export async function exchangeForLongLivedToken(
	shortLivedToken: string,
): Promise<FacebookLongLivedTokenResponse> {
	const response = await fetch(
		`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${env.FACEBOOK_APP_ID}&client_secret=${env.FACEBOOK_APP_SECRET}&fb_exchange_token=${shortLivedToken}`,
	);

	if (!response.ok) {
		throw new Error(
			`Failed to exchange for long-lived token: ${await response.text()}`,
		);
	}

	return await response.json();
}

/**
 * Get a system user access token for a business
 * This token never expires and is tied to the app, not the user
 * Requires the business to have set up system users in Business Manager
 */
export async function getSystemUserToken(
	businessId: string,
	systemUserId: string,
): Promise<SystemUserTokenResponse> {
	// This requires additional setup in Facebook Business Manager
	// The business needs to create a system user and assign it to the app
	const response = await fetch(
		`https://graph.facebook.com/v19.0/${businessId}/access_token?client_id=${env.FACEBOOK_APP_ID}&client_secret=${env.FACEBOOK_APP_SECRET}&system_user_id=${systemUserId}`,
	);

	if (!response.ok) {
		throw new Error(
			`Failed to get system user token: ${await response.text()}`,
		);
	}

	return await response.json();
}

/**
 * Debug a Facebook token to check its validity and expiration
 */
export async function debugToken(
	accessToken: string,
): Promise<FacebookDebugTokenResponse> {
	const appAccessToken = `${env.FACEBOOK_APP_ID}|${env.FACEBOOK_APP_SECRET}`;

	const response = await fetch(
		`https://graph.facebook.com/v19.0/debug_token?input_token=${accessToken}&access_token=${appAccessToken}`,
	);

	if (!response.ok) {
		throw new Error(`Failed to debug token: ${await response.text()}`);
	}

	return await response.json();
}

/**
 * Get Facebook pages associated with a user
 */
export async function getUserPages(
	accessToken: string,
): Promise<FacebookPageResponse> {
	const response = await fetch(
		`https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`,
	);

	if (!response.ok) {
		throw new Error(`Failed to get user pages: ${await response.text()}`);
	}

	return await response.json();
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
 * This function tries multiple approaches to find the Instagram business account
 */
export async function getInstagramBusinessAccount(
	pageId: string,
	pageAccessToken: string,
): Promise<InstagramBusinessAccountResponse | undefined> {
	const response = await fetch(
		`https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`,
	);

	if (response.ok) {
		const data = await response.json();
		if (data.instagram_business_account?.id) {
			// Get Instagram details using the business account ID
			const igDetailsResponse = await fetch(
				`https://graph.facebook.com/v19.0/${data.instagram_business_account.id}?fields=id,username,profile_picture_url&access_token=${pageAccessToken}`,
			);

			if (igDetailsResponse.ok) {
				const igDetails = await igDetailsResponse.json();

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
 * Get Instagram user profile information using the Graph API
 */
export async function getInstagramUserProfile(
	igBusinessId: string,
	accessToken: string,
): Promise<InstagramUserProfile> {
	const response = await fetch(
		`https://graph.facebook.com/v19.0/${igBusinessId}?fields=id,username,name&access_token=${accessToken}`,
	);

	if (!response.ok) {
		throw new Error(`Failed to get user profile: ${await response.text()}`);
	}

	return await response.json();
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
		throw new Error(`Failed to get media: ${await response.text()}`);
	}

	return await response.json();
}

/**
 * Get a non-expiring page access token using the following procedure:
 * 1. Exchange user token for long-lived user token
 * 2. Get page access token with the long-lived user token
 * 3. This page access token is essentially non-expiring
 */
export async function getNonExpiringPageAccessToken(
	userAccessToken: string,
	pageId: string,
): Promise<string> {
	// When we already have pageId and accessToken from page selection
	if (pageId) {
		// Try to directly exchange the access token
		// First, check if this token is directly usable as a page token
		// This happens when we're directly passing a page token from page selection
		const debugResponse = await fetch(
			`https://graph.facebook.com/v19.0/debug_token?input_token=${userAccessToken}&access_token=${env.FACEBOOK_APP_ID}|${env.FACEBOOK_APP_SECRET}`,
		);

		const debugData = await debugResponse.json();

		// If token has page scopes, we can use it directly
		if (
			debugResponse.ok &&
			debugData?.data?.type === "PAGE" &&
			debugData?.data?.is_valid
		) {
			return userAccessToken;
		}

		// Otherwise, get the page token directly
		const response = await fetch(
			`https://graph.facebook.com/v19.0/${pageId}?fields=access_token&access_token=${userAccessToken}`,
		);

		if (!response.ok) {
			throw new Error(
				`Failed to get page access token: ${await response.text()}`,
			);
		}

		const data = await response.json();
		if (data.access_token) {
			return data.access_token;
		}
	}

	// Step 1: Get long-lived user access token
	const longLivedTokenResponse =
		await exchangeForLongLivedToken(userAccessToken);

	// Step 2: Get pages with the long-lived token
	const pagesResponse = await getUserPages(longLivedTokenResponse.access_token);

	// Step 3: Find the requested page and return its access token
	const page = pagesResponse.data.find((p) => p.id === pageId);

	if (!page) {
		throw new Error(`Page with ID ${pageId} not found`);
	}

	// This page token is essentially non-expiring when obtained this way
	return page.access_token;
}

/**
 * Check token validity and refresh if needed
 *
 * For our system:
 * - We check if the token is valid using debug_token endpoint
 * - Never-expiring tokens (shown by expires_at = 0 or null) never need refresh
 * - For expiring tokens, we attempt to convert to non-expiring if possible
 */
export async function checkAndRefreshToken(
	clubId: string,
): Promise<{ token: string | null; igBusinessId: string | null }> {
	const club = await prisma.club.findUnique({
		where: { id: clubId },
		select: {
			instagramAccessToken: true,
			instagramBusinessId: true,
			instagramTokenExpiry: true,
			facebookPageId: true,
			instagramTokenType: true, // Add this field to identify token types
		},
	});

	if (!club?.instagramAccessToken || !club?.instagramBusinessId) {
		return { token: null, igBusinessId: null };
	}

	try {
		// Check if we have a permanent token
		if (club.instagramTokenType === "PERMANENT") {
			// Non-expiring token, just verify it's still valid
			const debugResponse = await debugToken(club.instagramAccessToken);

			if (!debugResponse.data.is_valid) {
				return { token: null, igBusinessId: null };
			}

			return {
				token: club.instagramAccessToken,
				igBusinessId: club.instagramBusinessId,
			};
		}

		// For normal tokens, check expiration
		const shouldRefreshToken =
			!club.instagramTokenExpiry ||
			new Date(club.instagramTokenExpiry) <
				new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

		if (shouldRefreshToken && club.facebookPageId) {
			// Try to get a non-expiring token
			const nonExpiringToken = await getNonExpiringPageAccessToken(
				club.instagramAccessToken,
				club.facebookPageId,
			);

			// Update the club with the non-expiring token
			await prisma.club.update({
				where: { id: clubId },
				data: {
					instagramAccessToken: nonExpiringToken,
					instagramTokenExpiry: null, // No expiry for non-expiring tokens
					instagramTokenType: "PERMANENT",
				},
			});

			return {
				token: nonExpiringToken,
				igBusinessId: club.instagramBusinessId,
			};
		}

		// If token refresh wasn't attempted or failed, check if existing token is valid
		const debugResponse = await debugToken(club.instagramAccessToken);

		if (!debugResponse.data.is_valid) {
			// Token is invalid, we need to re-authenticate
			return { token: null, igBusinessId: null };
		}

		// Update expiration if there is one
		if (debugResponse.data.expires_at) {
			await prisma.club.update({
				where: { id: clubId },
				data: {
					instagramTokenExpiry: new Date(debugResponse.data.expires_at * 1000),
				},
			});
		}

		return {
			token: club.instagramAccessToken,
			igBusinessId: club.instagramBusinessId,
		};
	} catch (error) {
		// In case of any error, we return the existing token and let the API call handle any issues
		return {
			token: club.instagramAccessToken,
			igBusinessId: club.instagramBusinessId,
		};
	}
}

/**
 * Disconnect Instagram from a club
 */
export async function disconnectInstagramAPI(clubId: string): Promise<boolean> {
	try {
		await prisma.club.update({
			where: { id: clubId },
			data: {
				instagramAccessToken: null,
				instagramUsername: null,
				instagramConnected: false,
				instagramTokenExpiry: null,
				instagramBusinessId: null,
				facebookPageId: null,
				instagramTokenType: null,
			},
		});

		return true;
	} catch (error) {
		return false;
	}
}
