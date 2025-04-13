import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInstagramBusinessAccount } from "@/lib/instagram";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const sessionId = searchParams.get("sessionId");
	const clubId = searchParams.get("clubId");

	if (!(sessionId && clubId)) {
		return NextResponse.json(
			{ error: "Missing sessionId or clubId" },
			{ status: 400 },
		);
	}

	// Validate session and permissions
	const user = await isAuthenticated();
	if (!user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		// Fetch the temporary session data
		const tempData = await prisma.instagramPageSelection.findFirst({
			where: {
				id: sessionId,
				clubId,
			},
		});

		if (!tempData) {
			return NextResponse.json(
				{ error: "Session not found or expired" },
				{ status: 404 },
			);
		}

		// Parse the pages data
		const pages = JSON.parse(tempData.pages);

		// For each page, check if it has an Instagram business account
		const pagesWithInstagramInfo = await Promise.all(
			pages.map(
				async (page: {
					id: string;
					name: string;
					access_token: string;
					instagram_business_account?: {
						id: string;
						username: string;
					};
				}) => {
					try {
						// Try to get Instagram business account for this page
						const instagramResponse = await getInstagramBusinessAccount(
							page.id,
							page.access_token,
						);

						// If successful, add the Instagram business account info to the page object
						if (instagramResponse?.instagram_business_account?.id) {
							return {
								...page,
								instagram_business_account:
									instagramResponse.instagram_business_account,
							};
						}

						// No Instagram business account found
						return page;
					} catch (error) {
						// Return the original page if there was an error
						return page;
					}
				},
			),
		);

		// Return the pages with Instagram info
		return NextResponse.json({
			pages: pagesWithInstagramInfo,
		});
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to retrieve Facebook pages" },
			{ status: 500 },
		);
	}
}
