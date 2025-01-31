import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

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

	const invite = await prisma.clubInvite.findUnique({
		where: { inviteCode: code },
		include: {
			club: true,
			user: true,
		},
	});

	if (!invite) {
		redirect(
			`${redirectTo}?message=${encodeURIComponent("Nepostojeći poziv")}`,
		);
	}

	if (invite.status === "EXPIRED") {
		redirect(
			`${redirectTo}?message=${encodeURIComponent("Pozivnica je istekla")}`,
		);
	}

	const user = await isAuthenticated();

	if (action === "dismiss") {
		// Check if user is authorized to dismiss
		if (invite.status === "REQUESTED") {
			// For requests, check if user is club manager or the requester
			const isManager = await prisma.clubMembership.findFirst({
				where: {
					userId: user?.id,
					clubId: invite.clubId,
					role: { in: ["MANAGER", "CLUB_OWNER"] },
				},
			});

			if (!isManager && invite.userId !== user?.id) {
				redirect(
					`${redirectTo}?message=${encodeURIComponent("Nemate dozvolu")}`,
				);
			}
		} else if (invite.email.toLowerCase() !== user?.email?.toLowerCase()) {
			redirect(`${redirectTo}?message=${encodeURIComponent("Nemate dozvolu")}`);
		}

		await prisma.clubInvite.update({
			where: { id: invite.id },
			data: { status: "REJECTED" },
		});
		redirect(`${redirectTo}?message=Odbijeno`);
	}

	if (invite.status === "REQUESTED") {
		// Only managers can approve requests
		const isManager = await prisma.clubMembership.findFirst({
			where: {
				userId: user?.id,
				clubId: invite.clubId,
				role: { in: ["MANAGER", "CLUB_OWNER"] },
			},
		});

		if (!isManager) {
			redirect(
				`${redirectTo}?message=${encodeURIComponent("Samo menadžeri mogu odobriti zahtjeve")}`,
			);
		}

		if (!invite.userId) {
			redirect(
				`${redirectTo}?message=${encodeURIComponent("Nepostojeći korisnik")}`,
			);
		}

		// Process the request approval
		await prisma.$transaction(async (tx) => {
			await tx.clubInvite.update({
				where: { id: invite.id },
				data: { status: "ACCEPTED" },
			});

			await tx.clubMembership.create({
				data: {
					userId: invite.userId!,
					clubId: invite.clubId,
					role: "USER",
				},
			});
		});

		redirect(`${redirectTo}?message=${encodeURIComponent("Zahtjev odobren")}`);
	}
	console.log("Invite status is not REQUESTED");

	// Continue with existing invite acceptance logic
	if (invite.expiresAt < new Date()) {
		await prisma.clubInvite.update({
			where: { id: invite.id },
			data: { status: "EXPIRED" },
		});
		redirect(
			`${redirectTo}?message=${encodeURIComponent("Pozivnica je istekla")}`,
		);
	}

	if (invite.status !== "PENDING") {
		redirect(
			`${redirectTo}?message=${encodeURIComponent("Pozivnica je već iskorištena")}`,
		);
	}

	// If no user is logged in, check if account exists
	if (!user) {
		const existingUser = await prisma.user.findUnique({
			where: {
				email: invite.email,
			},
		});

		// Add the invite URL to cookie for post-login redirect
		const cookieStore = await cookies();
		const existingInviteUrl = cookieStore.get("inviteUrl");

		if (!existingInviteUrl) {
			const maxAge = Math.max(
				0,
				(invite.expiresAt.getTime() - Date.now()) / 1000,
			);
			cookieStore.set("inviteUrl", req.url, {
				maxAge: maxAge, // Set maxAge to the remaining time until invite expires
				httpOnly: false,
				secure: true,
				sameSite: "strict",
			});
		}

		redirect(existingUser ? "/login" : `/register?email=${invite.email}`);
	}

	// User is logged in - verify email matches
	if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
		// Wrong account logged in
		const currentUrl = req.url;
		redirect(
			`/login?redirectTo=${encodeURIComponent(currentUrl)}&message=${encodeURIComponent("Pozivnica nije za vaš nalog")}`,
		);
	}

	const existingMembership = await prisma.clubMembership.findFirst({
		where: {
			userId: user.id,
			clubId: invite.clubId,
		},
	});

	if (existingMembership) {
		redirect(
			`${redirectTo}?message=${encodeURIComponent("Već ste član kluba")}`,
		);
	}

	await prisma.$transaction(async (tx) => {
		const updatedInvite = await tx.clubInvite.update({
			where: { id: invite.id },
			data: {
				status: "ACCEPTED",
				userId: user.id,
			},
		});

		const membership = await tx.clubMembership.create({
			data: {
				userId: user.id,
				clubId: invite.clubId,
				role: "USER",
			},
		});

		return { updatedInvite, membership };
	});

	redirect(
		`${redirectTo}?message=${encodeURIComponent("Članstvo uspješno prihvaćeno")}`,
	);
}
