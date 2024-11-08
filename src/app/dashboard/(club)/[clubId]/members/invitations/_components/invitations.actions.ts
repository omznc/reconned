"use server";

import { sendInvitationSchema } from "@/app/dashboard/(club)/[clubId]/members/invitations/_components/invitations.schema";
import ClubInvitationEmail from "@/emails/airsoft-invitation";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { DEFAULT_FROM, resend } from "@/lib/resend";
import { safeActionClient } from "@/lib/safe-action";
import { Role } from "@prisma/client";

export const sendInvitation = safeActionClient
	.schema(sendInvitationSchema)
	.action(async ({ parsedInput, ctx }) => {
		try {
			const club = await prisma.club.findUnique({
				where: {
					id: parsedInput.clubId,
					members: {
						some: {
							userId: ctx.user.id,
							role: {
								in: [Role.MANAGER, Role.CLUB_OWNER],
							},
						},
					},
				},
				select: {
					id: true,
					logo: true,
					name: true,
					location: true,
				},
			});

			if (!club) {
				throw new Error("Club not found.");
			}

			const existingInvite = await prisma.clubInvite.findFirst({
				where: {
					email: parsedInput.userEmail,
					clubId: club.id,
					status: "PENDING",
					expiresAt: {
						gt: new Date(),
					},
				},
			});

			if (existingInvite) {
				throw new Error(
					"There's already a pending invitation for this email address.",
				);
			}

			const existingMembership = await prisma.clubMembership.findFirst({
				where: {
					club: { id: club.id },
					user: { email: parsedInput.userEmail },
				},
			});

			if (existingMembership) {
				throw new Error("This user is already a member of the club.");
			}

			// Generate unique invite code
			const code = Math.random().toString(36).substring(2, 8).toUpperCase();

			const existingUser = await prisma.user.findUnique({
				where: {
					email: parsedInput.userEmail,
				},
				select: {
					id: true,
				},
			});

			const invite = await prisma.clubInvite.create({
				data: {
					email: parsedInput.userEmail,
					clubId: club.id,
					status: "PENDING",
					inviteCode: code,
					expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
					...(existingUser && {
						userId: existingUser.id,
					}),
				},
			});

			const resp = await resend.emails.send({
				from: DEFAULT_FROM,
				to: parsedInput.userEmail,
				subject: `Pozivnica za klub ${club.name}`,
				react: ClubInvitationEmail({
					name: parsedInput.userName,
					url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/api/club/member-invite/${invite.inviteCode}`,
					code: invite.inviteCode,
					clubLogo: club?.logo || "",
					clubName: club?.name || "Airsoft BiH",
					clubLocation: club?.location || "BiH",
				}),
			});

			return {
				success: true,
				data: {
					invite,
					emailResponse: resp,
				},
			};
		} catch (error) {
			if (error instanceof Error) {
				return {
					success: false,
					error: error.message,
				};
			}
			return {
				success: false,
				error: "An unexpected error occurred.",
			};
		}
	});
