import { prisma } from "@/lib/prisma";
import { deleteS3Files } from "@/lib/storage";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { subDays, subMonths } from "date-fns";

export async function GET(request: Request) {
	// Verify admin webhook token
	const authHeader = request.headers.get("authorization");
	if (authHeader !== `Bearer ${env.ADMIN_WEBHOOK_TOKEN}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const thirtyDaysAgo = subDays(new Date(), 30);
	const threeMonthsAgo = subMonths(new Date(), 3);
	const now = new Date();

	try {
		// Find unverified users to clean up their images first
		const unverifiedUsers = await prisma.user.findMany({
			where: {
				emailVerified: false,
				createdAt: { lt: thirtyDaysAgo },
				image: { not: null },
			},
			select: { id: true, image: true },
		});

		// Delete unverified users' images from S3
		if (unverifiedUsers.length > 0) {
			const imageKeys = unverifiedUsers
				.map((user) => user.image)
				.filter(Boolean)
				.map((image) => image?.replace(`${env.NEXT_PUBLIC_CDN_URL}/`, ""));

			if (imageKeys.length > 0) {
				await deleteS3Files(imageKeys.filter((key) => key !== undefined));
			}
		}

		const results = await prisma.$transaction([
			// Clean up unverified users
			prisma.user.deleteMany({
				where: {
					emailVerified: false,
					createdAt: { lt: thirtyDaysAgo },
				},
			}),

			// Set expired club invites to expired
			prisma.clubInvite.updateMany({
				where: {
					expiresAt: { lt: now },
				},
				data: {
					status: "EXPIRED",
				},
			}),

			// Clean up expired club invites older than 3 months
			prisma.clubInvite.deleteMany({
				where: {
					expiresAt: { lt: threeMonthsAgo },
				},
			}),

			// Clean up expired event invites older than 3 months
			prisma.eventInvite.deleteMany({
				where: {
					expiresAt: { lt: threeMonthsAgo },
				},
			}),

			// Remove expired user bans
			prisma.user.updateMany({
				where: {
					banned: true,
					banExpires: { lt: now },
				},
				data: {
					banned: false,
					banReason: null,
					banExpires: null,
				},
			}),

			// Remove expired club bans
			prisma.club.updateMany({
				where: {
					banned: true,
					banExpires: { lt: now },
				},
				data: {
					banned: false,
					banReason: null,
					banExpires: null,
				},
			}),

			// Delete audit logs older than a year
			prisma.clubAuditLog.deleteMany({
				where: {
					createdAt: { lt: subMonths(now, 12) },
				},
			}),
		]);

		return NextResponse.json({
			deletedUnverifiedUsers: results[0].count,
			deletedClubInvites: results[1].count,
			deletedEventInvites: results[2].count,
			unbannedUsers: results[3].count,
			unbannedClubs: results[4].count,
			expiredClubBans: results[5].count,
			deletedAuditLogs: results[6].count,
		});
	} catch (error) {
		return NextResponse.json({ error: "Čišćenje nije uspjelo" }, { status: 500 });
	}
}
