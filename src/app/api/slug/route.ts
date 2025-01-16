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
			const [clubBySlug, clubById] = await Promise.all([
				prisma.club.findUnique({
					where: { slug },
					select: { id: true },
				}),
				prisma.club.findUnique({
					where: { id: slug },
					select: { id: true },
				}),
			]);

			if (clubBySlug || clubById) {
				return NextResponse.json(
					{ error: "Slug already exists or conflicts with an ID" },
					{ status: 400 },
				);
			}
			return NextResponse.json({ message: "Slug is available" });
		}
		case "event": {
			const [eventBySlug, eventById] = await Promise.all([
				prisma.event.findUnique({
					where: { slug },
					select: { id: true },
				}),
				prisma.event.findUnique({
					where: { id: slug },
					select: { id: true },
				}),
			]);

			if (eventBySlug || eventById) {
				return NextResponse.json(
					{ error: "Slug already exists or conflicts with an ID" },
					{ status: 400 },
				);
			}
			return NextResponse.json({ message: "Slug is available" });
		}
		case "user": {
			const [userBySlug, userById] = await Promise.all([
				prisma.user.findUnique({
					where: { slug },
					select: { id: true },
				}),
				prisma.user.findUnique({
					where: { id: slug },
					select: { id: true },
				}),
			]);

			if (userBySlug || userById) {
				return NextResponse.json(
					{ error: "Slug already exists or conflicts with an ID" },
					{ status: 400 },
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
