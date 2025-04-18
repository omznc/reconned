"use server";

import MembershipExpiration from "@/emails/membership-expiration";
import MembershipExpirationOwner from "@/emails/membership-expiration-owner";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { format, addDays, startOfDay, endOfDay } from "date-fns";
import { render } from "@react-email/components";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

type MembershipWithRelations = Prisma.ClubMembershipGetPayload<{
	include: {
		user: {
			select: {
				id: true;
				name: true;
				email: true;
			};
		};
		club: {
			select: {
				id: true;
				name: true;
				logo: true;
			};
		};
	};
}>;

async function notifyMember(membership: MembershipWithRelations, isExpired: boolean) {
	try {
		const user = membership.user;
		const club = membership.club;
		const expiryDate = format(membership.endDate as Date, "dd.MM.yyyy");
		const daysUntilExpiry = isExpired ? 0 : 7;

		await sendEmail({
			to: user.email,
			subject: isExpired
				? `Vaše članstvo u klubu ${club.name} je isteklo`
				: `Vaše članstvo u klubu ${club.name} ističe za ${daysUntilExpiry} dana`,
			html: await render(
				<MembershipExpiration
					userName={user.name}
					clubName={club.name}
					clubLogo={club.logo || ""}
					expiryDate={expiryDate}
					daysUntilExpiry={daysUntilExpiry}
					renewUrl={`${env.NEXT_PUBLIC_BETTER_AUTH_URL}/dashboard/${club.id}/members`}
					isExpired={isExpired}
				/>,
				{ pretty: true },
			),
		});

		return true;
	} catch (error) {
		return false;
	}
}

async function notifyClubOwner(membership: MembershipWithRelations, isExpired: boolean) {
	try {
		const user = membership.user;
		const club = membership.club;
		const expiryDate = format(membership.endDate as Date, "dd.MM.yyyy");
		const daysUntilExpiry = isExpired ? 0 : 7;

		// Find club owner
		const clubOwner = await prisma.clubMembership.findFirst({
			where: {
				clubId: club.id,
				role: "CLUB_OWNER",
			},
			include: {
				user: true,
			},
		});

		if (!clubOwner) {
			return false;
		}

		await sendEmail({
			to: clubOwner.user.email,
			subject: isExpired
				? `Članstvo korisnika ${user.name} u klubu ${club.name} je isteklo`
				: `Članstvo korisnika ${user.name} u klubu ${club.name} ističe za ${daysUntilExpiry} dana`,
			html: await render(
				<MembershipExpirationOwner
					ownerName={clubOwner.user.name}
					clubName={club.name}
					clubLogo={club.logo || ""}
					memberName={user.name}
					expiryDate={expiryDate}
					daysUntilExpiry={daysUntilExpiry}
					membersUrl={`${env.NEXT_PUBLIC_BETTER_AUTH_URL}/dashboard/${club.id}/members`}
					isExpired={isExpired}
				/>,
				{ pretty: true },
			),
		});

		return true;
	} catch (error) {
		return false;
	}
}

async function processNotifications(membership: MembershipWithRelations, isExpired: boolean) {
	const [memberNotified, ownerNotified] = await Promise.all([
		notifyMember(membership, isExpired),
		notifyClubOwner(membership, isExpired),
	]);

	return {
		memberNotified,
		ownerNotified,
	};
}

export async function GET(request: Request) {
	// Verify admin webhook token
	const authHeader = request.headers.get("authorization");
	if (authHeader !== `Bearer ${env.ADMIN_WEBHOOK_TOKEN}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const today = new Date();
	const todayStart = startOfDay(today);
	const todayEnd = endOfDay(today);

	const sevenDaysFromNow = addDays(today, 7);
	const sevenDaysStart = startOfDay(sevenDaysFromNow);
	const sevenDaysEnd = endOfDay(sevenDaysFromNow);

	try {
		// Find memberships expiring exactly 7 days from now and today in parallel
		const [expiringMemberships, expiredMemberships] = await Promise.all([
			prisma.clubMembership.findMany({
				where: {
					endDate: {
						not: null,
						gte: sevenDaysStart,
						lte: sevenDaysEnd,
					},
				},
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
					club: {
						select: {
							id: true,
							name: true,
							logo: true,
						},
					},
				},
			}),
			prisma.clubMembership.findMany({
				where: {
					endDate: {
						not: null,
						gte: todayStart,
						lte: todayEnd,
					},
				},
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
					club: {
						select: {
							id: true,
							name: true,
							logo: true,
						},
					},
				},
			}),
		]);

		// Process expiring memberships in parallel
		const expiringResults = await Promise.all(
			expiringMemberships.map((membership) => processNotifications(membership, false)),
		);

		const expiringNotifications = expiringResults.reduce(
			(acc, result) => {
				if (result.memberNotified) {
					acc.members++;
				}
				if (result.ownerNotified) {
					acc.owners++;
				}
				return acc;
			},
			{ members: 0, owners: 0 },
		);

		// Process expired memberships in parallel
		const expiredResults = await Promise.all(
			expiredMemberships.map((membership) => processNotifications(membership, true)),
		);

		const expiredNotifications = expiredResults.reduce(
			(acc, result) => {
				if (result.memberNotified) {
					acc.members++;
				}
				if (result.ownerNotified) {
					acc.owners++;
				}
				return acc;
			},
			{ members: 0, owners: 0 },
		);

		return NextResponse.json({
			expiringMemberships: {
				count: expiringMemberships.length,
				notificationsSent: expiringNotifications,
			},
			expiredMemberships: {
				count: expiredMemberships.length,
				notificationsSent: expiredNotifications,
			},
		});
	} catch (error) {
		return NextResponse.json({ error: "Membership reminder failed" }, { status: 500 });
	}
}
