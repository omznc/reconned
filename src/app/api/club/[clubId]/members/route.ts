import { isAuthenticated } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import type { Role } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ clubId: string }> },
) {
	const session = isAuthenticated();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const query = searchParams.get("query");
	const role = searchParams.get("role");
	const { clubId } = await params;

	try {
		const members = await prisma.clubMembership.findMany({
			where: {
				clubId: clubId,
				role: (role as Role) || "USER",
				user: query
					? {
							// biome-ignore lint/style/useNamingConvention: <explanation>
							OR: [
								{ name: { contains: query, mode: "insensitive" } },
								{ email: { contains: query, mode: "insensitive" } },
								{ callsign: { contains: query, mode: "insensitive" } },
							],
						}
					: undefined,
			},
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						callsign: true,
					},
				},
			},
			take: 5,
		});

		return NextResponse.json(members);
	} catch (_error) {
		return NextResponse.json(
			{ error: "Neuspjela pretraga članova kluba" },
			{ status: 500 },
		);
	}
}
