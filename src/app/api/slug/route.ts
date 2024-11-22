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
	const type = searchParams.get("type");
	const slug = searchParams.get("slug");

	if (!type) {
		return NextResponse.json(
			{ error: "Type parameter is required" },
			{ status: 400 },
		);
	}

	if (!slug) {
		return NextResponse.json(
			{ error: "Slug parameter is required" },
			{ status: 400 },
		);
	}

	switch (type) {
		case "club": {
			const club = await prisma.club.findUnique({
				where: {
					slug,
				},
				select: {
					id: true,
				},
			});
			if (club) {
				return NextResponse.json(
					{ error: "Slug already exists" },
					{ status: 400 },
				);
			}
			return NextResponse.json({ message: "Slug is available" });
		}
		case "event": {
			const event = await prisma.event.findUnique({
				where: {
					slug,
				},
				select: {
					id: true,
				},
			});
			if (event) {
				return NextResponse.json(
					{
						error: "Slug already exists",
					},
					{
						status: 400,
					},
				);
			}
			return NextResponse.json({ message: "Slug is available" });
		}
		case "user": {
			const user = await prisma.user.findUnique({
				where: {
					slug,
				},
				select: {
					id: true,
				},
			});
			if (user) {
				return NextResponse.json(
					{
						error: "Slug already exists",
					},
					{
						status: 400,
					},
				);
			}
			return NextResponse.json({ message: "Slug is available" });
		}
		default: {
			return NextResponse.json(
				{ error: "Invalid type parameter" },
				{ status: 400 },
			);
		}
	}
}
