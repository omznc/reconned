import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	const user = await isAuthenticated();
	if (user?.role !== "admin") {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const query = searchParams.get("query") ?? "";

	try {
		const users = await prisma.user.findMany({
			where: {
				id: {
					not: user.id,
				},
				OR: [
					{ name: { contains: query, mode: "insensitive" } },
					{ email: { contains: query, mode: "insensitive" } },
					{ callsign: { contains: query, mode: "insensitive" } },
				],
			},
			select: {
				id: true,
				name: true,
				email: true,
				callsign: true,
			},
			take: 5,
		});

		return NextResponse.json(users);
	} catch (_error) {
		return NextResponse.json({ error: "Neuspjela pretraga korisnika" }, { status: 500 });
	}
}
