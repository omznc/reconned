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

	// Validate the invite regardless of auth status
	const invite = await prisma.clubInvite.findUnique({
		where: {
			inviteCode: code,
		},
		include: {
			club: true,
		},
	});

	if (!invite) {
		redirect(`/error?message=${encodeURIComponent("Nepostojeći poziv")}`);
	}

	if (invite.expiresAt < new Date()) {
		if (invite.status !== "EXPIRED") {
			await prisma.clubInvite.update({
				where: { id: invite.id },
				data: { status: "EXPIRED" },
			});
		}
		redirect(`/error?message=${encodeURIComponent("Pozivnica je istekla")}`);
	}

	if (invite.status !== "PENDING") {
		redirect(
			`/error?message=${encodeURIComponent("Pozivnica je već iskorištena")}`,
		);
	}

	const user = await isAuthenticated();

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
			`/dashboard/clubs/${invite.clubId}?message=${encodeURIComponent("Već ste član kluba")}`,
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

	redirect(`/?message=${encodeURIComponent("Članstvo uspješno prihvaćeno")}`);
}
