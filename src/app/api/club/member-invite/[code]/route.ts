import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "@/i18n/navigation";
import type { NextRequest } from "next/server";
import { getLocale } from "next-intl/server";

interface RouteParams {
	params: Promise<{
		code: string;
	}>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
	const { code } = await params;
	const { searchParams } = new URL(req.url);
	const action = searchParams.get("action");
	const redirectTo = searchParams.get("redirectTo") ?? "/";

	const locale = await getLocale();

	const invite = await prisma.clubInvite.findUnique({
		where: { inviteCode: code },
		include: {
			club: true,
			user: true,
		},
	});

	if (!invite) {
		return redirect({
			href: `${redirectTo}?message=${encodeURIComponent("Nepostojeći poziv")}`,
			locale,
		});
	}

	if (invite.status === "EXPIRED") {
		return redirect({
			href: `${redirectTo}?message=${encodeURIComponent("Pozivnica je istekla")}`,
			locale,
		});
	}

	const user = await isAuthenticated();

	if (action === "dismiss") {
		if (invite.status === "REQUESTED") {
			const isManager = await prisma.clubMembership.findFirst({
				where: {
					userId: user?.id,
					clubId: invite.clubId,
					role: { in: ["MANAGER", "CLUB_OWNER"] },
				},
			});

			if (!isManager && invite.userId !== user?.id) {
				return redirect({
					href: `${redirectTo}?message=${encodeURIComponent("Nemate dozvolu")}`,
					locale,
				});
			}
		} else if (invite.email.toLowerCase() !== user?.email?.toLowerCase()) {
			return redirect({
				href: `${redirectTo}?message=${encodeURIComponent("Nemate dozvolu")}`,
				locale,
			});
		}

		await prisma.clubInvite.update({
			where: { id: invite.id },
			data: { status: "REJECTED" },
		});
		return redirect({
			href: `${redirectTo}?message=Odbijeno`,
			locale,
		});
	}

	if (invite.status === "REQUESTED") {
		const isManager = await prisma.clubMembership.findFirst({
			where: {
				userId: user?.id,
				clubId: invite.clubId,
				role: { in: ["MANAGER", "CLUB_OWNER"] },
			},
		});

		if (!isManager) {
			return redirect({
				href: `${redirectTo}?message=${encodeURIComponent("Samo menadžeri mogu odobriti zahtjeve")}`,
				locale,
			});
		}

		if (!invite.userId) {
			return redirect({
				href: `${redirectTo}?message=${encodeURIComponent("Nepostojeći korisnik")}`,
				locale,
			});
		}

		await prisma.$transaction(async (tx) => {
			await tx.clubInvite.update({
				where: { id: invite.id },
				data: { status: "ACCEPTED" },
			});

			await tx.clubMembership.create({
				data: {
					userId: invite.userId as string,
					clubId: invite.clubId,
					role: "USER",
				},
			});
		});

		return redirect({
			href: `${redirectTo}?message=${encodeURIComponent("Zahtjev odobren")}`,
			locale,
		});
	}

	if (invite.expiresAt < new Date()) {
		await prisma.clubInvite.update({
			where: { id: invite.id },
			data: { status: "EXPIRED" },
		});
		return redirect({
			href: `${redirectTo}?message=${encodeURIComponent("Pozivnica je istekla")}`,
			locale,
		});
	}

	if (invite.status !== "PENDING") {
		return redirect({
			href: `${redirectTo}?message=${encodeURIComponent("Pozivnica je već iskorištena")}`,
			locale,
		});
	}

	const existingUser = await prisma.user.findUnique({
		where: {
			email: invite.email,
		},
	});

	if (existingUser) {
		await prisma.$transaction(async (tx) => {
			await tx.clubInvite.update({
				where: { id: invite.id },
				data: {
					status: "ACCEPTED",
					userId: existingUser.id,
				},
			});

			const existingMembership = await tx.clubMembership.findFirst({
				where: {
					userId: existingUser.id,
					clubId: invite.clubId,
				},
			});

			if (!existingMembership) {
				await tx.clubMembership.create({
					data: {
						userId: existingUser.id,
						clubId: invite.clubId,
						role: "USER",
					},
				});
			}
		});

		return redirect({
			href: user ? redirectTo : `/login?email=${invite.email}`,
			locale,
		});
	}

	return redirect({
		href: `/register?email=${invite.email}`,
		locale,
	});
}
