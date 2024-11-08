import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
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

	const session = await auth.api.getSession({
		headers: await headers(),
	});

	// If no user is logged in, check if account exists
	if (!session?.user) {
		const existingUser = await prisma.user.findUnique({
			where: {
				email: invite.email,
			},
		});

		if (existingUser) {
			// Account exists - redirect to login with the current URL as return URL
			const currentUrl = req.url; // This gets the full URL including the code
			redirect(`/login?redirectTo=${encodeURIComponent(currentUrl)}`);
		}

		// No account exists - redirect to registration
		redirect("/register");
	}

	// User is logged in - verify email matches
	if (invite.email.toLowerCase() !== session.user.email?.toLowerCase()) {
		// Wrong account logged in
		const currentUrl = req.url;
		redirect(
			`/login?redirectTo=${encodeURIComponent(currentUrl)}&message=${encodeURIComponent("Pozivnica nije za vaš nalog")}`,
		);
	}

	const existingMembership = await prisma.clubMembership.findFirst({
		where: {
			userId: session.user.id,
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
				userId: session.user.id,
			},
		});

		const membership = await tx.clubMembership.create({
			data: {
				userId: session.user.id,
				clubId: invite.clubId,
				role: "USER",
			},
		});

		return { updatedInvite, membership };
	});

	redirect(`/?message=${encodeURIComponent("Članstvo uspješno prihvaćeno")}`);
}
