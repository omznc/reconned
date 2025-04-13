"use server";

import { type NextRequest, NextResponse } from "next/server";
import { checkAndRefreshToken, getInstagramMedia } from "@/lib/instagram";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const clubId = searchParams.get("clubId");
	const limit = Number.parseInt(searchParams.get("limit") || "12");

	if (!clubId) {
		return NextResponse.json({ error: "Club ID is required" }, { status: 400 });
	}

	try {
		// Check if token needs to be refreshed and get the current token
		const { token, igBusinessId } = await checkAndRefreshToken(clubId);

		if (!(token && igBusinessId)) {
			return NextResponse.json(
				{ error: "Instagram not connected" },
				{ status: 404 },
			);
		}

		// Fetch the Instagram media using the Graph API
		const media = await getInstagramMedia(igBusinessId, token, limit);

		return NextResponse.json(media);
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to fetch Instagram photos" },
			{ status: 500 },
		);
	}
}
