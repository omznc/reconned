"use server";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
	exchangeCodeForToken,
	exchangeForLongLivedToken,
	getUserPages,
	getInstagramBusinessAccount,
	debugToken,
	getNonExpiringPageAccessToken,
} from "@/lib/instagram";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

// Define error codes for more specific error handling
const ERROR_CODES = {
	NO_FACEBOOK_PAGES: "no_facebook_pages",
	NO_INSTAGRAM_BUSINESS_ACCOUNT: "no_instagram_business_account",
	NOT_CONNECTED_TO_PAGE: "not_connected_to_instagram",
	MISSING_PARAMS: "missing_params",
	AUTH_FAILED: "auth_failed",
	CONNECTION_FAILED: "connection_failed",
	PAGE_NOT_FOUND: "page_not_found",
	PERSONAL_ACCOUNT: "personal_account", // New error code for personal accounts
};

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const code = searchParams.get("code");
	const state = searchParams.get("clubId") || searchParams.get("state");
	const error = searchParams.get("error");
	const locale = await getLocale();
	const selectedPageId = searchParams.get("pageId");
	const accessToken = searchParams.get("accessToken");

	if (error) {
		return redirect(
			`/${locale}/dashboard/${state}/club/information?instagramError=${error}#instagram`,
		);
	}

	if (!((code && state) || selectedPageId)) {
		return redirect(
			`/${locale}/dashboard/${state}/club/information?instagramError=${ERROR_CODES.MISSING_PARAMS}#instagram`,
		);
	}

	try {
		// Handle the case when user has selected a page
		if (selectedPageId && accessToken && state) {
			return await handlePageSelection(
				selectedPageId,
				accessToken,
				state,
				locale,
			);
		}

		if (!(code && state)) {
			return redirect(
				`/${locale}/dashboard/${state}/club/information?instagramError=${ERROR_CODES.MISSING_PARAMS}#instagram`,
			);
		}

		const shortLivedTokenResponse = await exchangeCodeForToken(code);

		const longLivedTokenResponse = await exchangeForLongLivedToken(
			shortLivedTokenResponse.access_token,
		);

		const pagesResponse = await getUserPages(
			longLivedTokenResponse.access_token,
		);

		if (!pagesResponse.data || pagesResponse.data.length === 0) {
			return redirect(
				`/${locale}/dashboard/${state}/club/information?instagramError=${ERROR_CODES.NO_FACEBOOK_PAGES}#instagram`,
			);
		}

		if (pagesResponse.data.length === 1) {
			const page = pagesResponse.data[0];
			if (!page?.id) {
				return redirect(
					`/${locale}/dashboard/${state}/club/information?instagramError=${ERROR_CODES.NOT_CONNECTED_TO_PAGE}#instagram`,
				);
			}

			return await handlePageSelection(
				page.id,
				longLivedTokenResponse.access_token,
				state,
				locale,
			);
		}

		// Multiple pages available - store them temporarily and redirect to page selection
		// Store the pages and token in a temporary table or session
		const tempData = await prisma.instagramPageSelection.create({
			data: {
				clubId: state,
				accessToken: longLivedTokenResponse.access_token,
				pages: JSON.stringify(pagesResponse.data),
				expiresAt: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes
			},
		});

		// Redirect to the page selection screen
		return redirect(
			`/${locale}/dashboard/${state}/club/information/instagram?sessionId=${tempData.id}`,
		);
	} catch (error) {
		// If the error is NEXT_REDIRECT, it should be re-thrown to be handled by Next.js
		if (error instanceof Error && error.message === "NEXT_REDIRECT") {
			throw error;
		}
		return redirect(
			`/${locale}/dashboard/${state}/club/information?instagramError=${ERROR_CODES.AUTH_FAILED}#instagram`,
		);
	}
}

// Helper function to process a page selection
async function handlePageSelection(
	pageId: string,
	accessToken: string,
	clubId: string,
	locale: string,
) {
	try {
		const nonExpiringToken = await getNonExpiringPageAccessToken(
			accessToken,
			pageId,
		);

		try {
			// First check if the Instagram business account exists on the page
			const pageResponse = await fetch(
				`https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${nonExpiringToken}`,
			);

			const pageData = await pageResponse.json();

			// If instagram_business_account is undefined or null, it's a personal account
			if (!pageData.instagram_business_account) {
				return redirect(
					`/${locale}/dashboard/${clubId}/club/information?instagramError=${ERROR_CODES.PERSONAL_ACCOUNT}#instagram`,
				);
			}

			const igBusinessResponse = await getInstagramBusinessAccount(
				pageId,
				nonExpiringToken,
			);

			if (!igBusinessResponse?.instagram_business_account?.id) {
				return redirect(
					`/${locale}/dashboard/${clubId}/club/information?instagramError=${ERROR_CODES.NO_INSTAGRAM_BUSINESS_ACCOUNT}#instagram`,
				);
			}

			const tokenInfo = await debugToken(nonExpiringToken);
			const isPermanentToken =
				!tokenInfo.data.expires_at || tokenInfo.data.expires_at === 0;

			await prisma.club.update({
				where: { id: clubId },
				data: {
					instagramUsername:
						igBusinessResponse.instagram_business_account.username,
					instagramProfilePictureUrl:
						igBusinessResponse.instagram_business_account.profile_picture_url,
					instagramAccessToken: nonExpiringToken,
					instagramConnected: true,
					instagramTokenExpiry: isPermanentToken
						? null
						: new Date((tokenInfo.data.expires_at ?? 0) * 1000),
					instagramBusinessId: igBusinessResponse.instagram_business_account.id,
					facebookPageId: pageId,
					instagramTokenType: isPermanentToken ? "PERMANENT" : "TEMPORARY",
				},
			});

			await prisma.instagramPageSelection.deleteMany({
				where: { clubId },
			});

			return redirect(
				`/${locale}/dashboard/${clubId}/club/information?instagramSuccess=true#instagram`,
			);
		} catch (error) {
			// If the error is NEXT_REDIRECT, it should be re-thrown to be handled by Next.js
			if (error instanceof Error && error.message === "NEXT_REDIRECT") {
				throw error;
			}

			// Handle specific error cases
			let errorCode = ERROR_CODES.CONNECTION_FAILED;
			let errorMessage = "";

			if (error instanceof Error) {
				errorMessage = error.message;

				if (
					errorMessage.includes("Cannot read properties of undefined") &&
					errorMessage.includes("instagram_business_account")
				) {
					errorCode = ERROR_CODES.PERSONAL_ACCOUNT;
				} else if (
					errorMessage.includes("Could not find an Instagram Business Account")
				) {
					errorCode = ERROR_CODES.NO_INSTAGRAM_BUSINESS_ACCOUNT;
				} else if (
					errorMessage.includes("Page with ID") &&
					errorMessage.includes("not found")
				) {
					errorCode = ERROR_CODES.PAGE_NOT_FOUND;
				}
			}
			return redirect(
				`/${locale}/dashboard/${clubId}/club/information?instagramError=${errorCode}&errorMessage=${encodeURIComponent(errorMessage)}#instagram`,
			);
		}
	} catch (error) {
		// If the error is NEXT_REDIRECT, it should be re-thrown to be handled by Next.js
		if (error instanceof Error && error.message === "NEXT_REDIRECT") {
			throw error;
		}
		return redirect(
			`/${locale}/dashboard/${clubId}/club/information?instagramError=${ERROR_CODES.CONNECTION_FAILED}#instagram`,
		);
	}
}
