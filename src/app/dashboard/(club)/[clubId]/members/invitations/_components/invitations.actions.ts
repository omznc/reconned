"use server";

import { sendInvitationSchema } from "@/app/dashboard/(club)/[clubId]/members/invitations/_components/invitations.schema";
import ClubInvitationEmail from "@/emails/airsoft-invitation";
import { prisma } from "@/lib/prisma";
import { DEFAULT_FROM, resend } from "@/lib/resend";
import { safeActionClient } from "@/lib/safe-action";
import { Role } from "@prisma/client";

export const sendInvitation = safeActionClient
	.schema(sendInvitationSchema)
	.action(async ({ parsedInput, ctx }) => {
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
			select: { logo: true, name: true, location: true },
		});

		if (!club) {
			throw new Error(
				"Club not found, or you don't have permission to send invitations.",
			);
		}

		const code = Math.random().toString(36).substring(2, 8).toUpperCase();

		// TODO: Create actual invitation, check if one doesn't already exist

		const resp = await resend.emails.send({
			from: DEFAULT_FROM,
			to: parsedInput.userEmail,
			subject: `Pozivnica za klub ${club.name}`,
			react: ClubInvitationEmail({
				name: parsedInput.userName,
				// TODO: Handle URL
				url: "",
				code,
				clubLogo: club?.logo || "",
				clubName: club?.name || "Airsoft BiH",
				clubLocation: club?.location || "BiH",
			}),
		});

		return resp;
	});
