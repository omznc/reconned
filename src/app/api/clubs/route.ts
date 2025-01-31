import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const user = await isAuthenticated();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const query = request.nextUrl.searchParams.get("query");

	if (!query || query.length < 2) {
		return NextResponse.json([]);
	}

	const clubs = await prisma.club.findMany({
		where: {
			isPrivate: false,
			name: {
				contains: query,
				mode: "insensitive",
			},
		},
		select: {
			id: true,
			name: true,
		},
		take: 10,
	});

	return NextResponse.json(clubs);
}
