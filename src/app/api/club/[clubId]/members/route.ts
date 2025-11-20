import type { Role } from "@generated/client";
import { NextResponse } from "next/server";
import { type AxiomRequest, withAxiom } from "next-axiom";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const GET = withAxiom(async (request: AxiomRequest, { params }: { params: Promise<{ clubId: string }> }) => {
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
		return NextResponse.json({ error: "Neuspjela pretraga članova kluba" }, { status: 500 });
	}
	// biome-ignore lint/suspicious/noExplicitAny: TODO: Fix once next-axiom sorts their stuff out
}) as any;
