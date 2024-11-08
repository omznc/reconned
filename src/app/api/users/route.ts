import { isAuthenticated } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(request: Request) {
	const session = isAuthenticated();

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const query = searchParams.get("query");

	if (!query) {
		return NextResponse.json(
			{ error: "Query parameter is required" },
			{ status: 400 },
		);
	}

	try {
		const users = await prisma.user.findMany({
			where: {
				name: {
					contains: query,
					mode: "insensitive",
				},
			},
			take: 5,
		});

		return NextResponse.json(users);
	} catch (_error) {
		return NextResponse.json(
			{ error: "Failed to search users" },
			{ status: 500 },
		);
	}
}
