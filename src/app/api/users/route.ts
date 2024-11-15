import { isAuthenticated } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(request: Request) {
	const user = await isAuthenticated();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const query = searchParams.get("query");
	const onlyUsersClub = searchParams.get("onlyUsersClub") === "true";
	const ignoreCurrentUser = searchParams.get("ignoreCurrentUser") === "true";

	if (!query) {
		return NextResponse.json(
			{ error: "Query parameter is required" },
			{ status: 400 },
		);
	}

	try {
		const where: any = {
			AND: [
				{
					OR: [
						{
							name: {
								contains: query,
								mode: "insensitive",
							},
						},
						{
							email: {
								contains: query,
								mode: "insensitive",
							},
						},
						{
							callsign: {
								contains: query,
								mode: "insensitive",
							},
						},
					],
				},
			],
		};

		if (ignoreCurrentUser || onlyUsersClub) {
			const currentUser = await prisma.user.findUnique({
				where: { id: user.id },
				include: {
					clubMembership: {
						select: {
							clubId: true,
						},
					},
				},
			});

			if (!currentUser) {
				return NextResponse.json({ error: "User not found" }, { status: 404 });
			}

			if (onlyUsersClub) {
				where.AND.push({
					clubMembership: {
						some: {
							clubId: {
								in: currentUser.clubMembership.map(
									(membership) => membership.clubId,
								),
							},
						},
					},
				});
			}

			if (ignoreCurrentUser) {
				where.AND.push({
					id: {
						not: currentUser.id,
					},
				});
			}
		}

		const users = await prisma.user.findMany({
			where,
			take: 5,
			select: {
				id: true,
				name: true,
				email: true,
				image: true,
				callsign: true,
				clubMembership: {
					select: {
						club: {
							select: {
								name: true,
							},
						},
					},
				},
			},
		});

		return NextResponse.json(users);
	} catch (_error) {
		return NextResponse.json(
			{ error: "Failed to search users" },
			{ status: 500 },
		);
	}
}
