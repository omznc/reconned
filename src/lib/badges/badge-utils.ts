"use server";

import { prisma } from "@/lib/prisma";
import { ACHIEVEMENT_BADGES } from "./badge-definitions";

interface UserBadgeEligibilityData {
	eventsAttended: number;
	clubMemberships: number;
	reviewsWritten: number;
	memberSinceDate: Date;
}

/**
 * Get user data for badge eligibility checks
 */
export async function getUserBadgeEligibilityData(userId: string): Promise<UserBadgeEligibilityData> {
	const [user, eventsAttended, clubMemberships, reviewsWritten] = await Promise.all([
		prisma.user.findUnique({
			where: { id: userId },
			select: { createdAt: true },
		}),
		prisma.eventRegistration.count({
			where: {
				createdById: userId,
				attended: true,
			},
		}),
		prisma.clubMembership.count({
			where: { userId },
		}),
		prisma.review.count({
			where: { authorId: userId },
		}),
	]);

	if (!user) {
		throw new Error("User not found");
	}

	return {
		eventsAttended,
		clubMemberships,
		reviewsWritten,
		memberSinceDate: user.createdAt,
	};
}

/**
 * Check and award achievement badges to a user
 */
export async function checkAndAwardAchievementBadges(userId: string) {
	const data = await getUserBadgeEligibilityData(userId);

	// Get existing user badges
	const existingBadges = await prisma.userBadge.findMany({
		where: { userId },
		include: { badge: true },
	});

	const existingSlugs = new Set(
		existingBadges.map((ub) => ub.badge.slug).filter((slug): slug is string => slug !== null),
	);

	// Check each achievement badge
	for (const achievementDef of ACHIEVEMENT_BADGES) {
		// Skip if user already has this badge
		if (existingSlugs.has(achievementDef.slug)) {
			continue;
		}

		// Check eligibility
		if (achievementDef.checkEligibility?.(data)) {
			// Find or create the achievement badge
			let badge = await prisma.badge.findUnique({
				where: { slug: achievementDef.slug },
			});

			if (!badge) {
				// Create the badge if it doesn't exist
				badge = await prisma.badge.create({
					data: {
						type: "ACHIEVEMENT",
						slug: achievementDef.slug,
						description: achievementDef.description,
						icon: achievementDef.icon,
						tier: achievementDef.tier,
					},
				});
			}

			// Award the badge to the user
			await prisma.userBadge.create({
				data: {
					userId,
					badgeId: badge.id,
				},
			});
		}
	}
}

/**
 * Award event badge to users involved in a specific registration
 */
export async function awardEventBadgeForRegistration(registrationId: string) {
	const registration = await prisma.eventRegistration.findUnique({
		where: { id: registrationId },
		include: {
			event: {
				include: {
					badge: true,
				},
			},
			invitedUsers: {
				select: {
					id: true,
				},
			},
		},
	});

	if (!registration || !registration.event.badge) {
		return;
	}

	const badge = registration.event.badge;

	// Award to the creator of the registration
	await prisma.userBadge.upsert({
		where: {
			userId_badgeId: {
				userId: registration.createdById,
				badgeId: badge.id,
			},
		},
		create: {
			userId: registration.createdById,
			badgeId: badge.id,
		},
		update: {},
	});

	// Award to all invited users
	for (const invitedUser of registration.invitedUsers) {
		await prisma.userBadge.upsert({
			where: {
				userId_badgeId: {
					userId: invitedUser.id,
					badgeId: badge.id,
				},
			},
			create: {
				userId: invitedUser.id,
				badgeId: badge.id,
			},
			update: {},
		});
	}

	// Check achievement badges for all affected users
	await checkAndAwardAchievementBadges(registration.createdById);
	for (const invitedUser of registration.invitedUsers) {
		await checkAndAwardAchievementBadges(invitedUser.id);
	}
}
