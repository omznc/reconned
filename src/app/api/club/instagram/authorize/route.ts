import { isAuthenticated } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getInstagramAuthUrl } from "@/lib/instagram";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
	const user = await isAuthenticated();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(req.url);
	const clubId = searchParams.get("clubId");

	if (!clubId) {
		return NextResponse.json({ error: "Club ID is required" }, { status: 400 });
	}

	// Check if user is club owner or manager
	const membership = await prisma.clubMembership.findFirst({
		where: {
			userId: user.id,
			clubId,
			role: { in: ["CLUB_OWNER", "MANAGER"] },
		},
	});

	if (!membership) {
		return NextResponse.json(
			{ error: "Unauthorized to manage this club" },
			{ status: 403 },
		);
	}

	try {
		const authUrl = await getInstagramAuthUrl(clubId);
		return NextResponse.json({ url: authUrl });
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to generate Instagram authorization URL" },
			{ status: 500 },
		);
	}
}
