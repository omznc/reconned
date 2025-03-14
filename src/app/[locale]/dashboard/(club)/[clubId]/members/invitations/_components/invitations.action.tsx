"use server";

import {
	revokeInvitationSchema,
	sendInvitationSchema,
} from "@/app/[locale]/dashboard/(club)/[clubId]/members/invitations/_components/invitations.schema";
import ClubInvitationEmail from "@/emails/airsoft-invitation";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mail";
import { safeActionClient } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { render } from "@react-email/components";

export const sendInvitation = safeActionClient
	.schema(sendInvitationSchema)
	.action(async ({ parsedInput, ctx }) => {
		try {
			const existingInvite = await prisma.clubInvite.findFirst({
				where: {
					email: parsedInput.userEmail,
					clubId: ctx.club.id,
					status: "PENDING",
					expiresAt: {
						gt: new Date(),
					},
				},
			});

			if (existingInvite) {
				throw new Error("Već ste poslali pozivnicu ovoj osobi.");
			}

			const existingMembership = await prisma.clubMembership.findFirst({
				where: {
					club: { id: ctx.club.id },
					user: { email: parsedInput.userEmail },
				},
			});

			if (existingMembership) {
				throw new Error("Osoba već ima članstvo u klubu.");
			}

			// Generate unique invite code
			const code = Math.random().toString(36).substring(2, 16).toUpperCase();

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
					clubId: ctx.club.id,
					status: "PENDING",
					inviteCode: code,
					expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
					...(existingUser && {
						userId: existingUser.id,
					}),
				},
			});

			const resp = await sendEmail({
				to: parsedInput.userEmail,
				subject: `Pozivnica za klub ${ctx.club.name}`,
				html: await render(
					<ClubInvitationEmail
						code={invite.inviteCode}
						url={`${env.NEXT_PUBLIC_BETTER_AUTH_URL}/api/club/member-invite/${invite.inviteCode}&redirectTo=${encodeURIComponent(
							"/",
						)}`}
						name={parsedInput.userName}
						clubLogo={ctx.club?.logo || ""}
						clubName={ctx.club?.name || "Airsoft BiH"}
						clubLocation={ctx.club?.location || "BiH"}
					/>,
					{
						pretty: true,
					},
				),
			});

			revalidatePath(`/dashboard/${ctx.club.id}/members/invitations`);

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
				error: "Došlo je do neočekivane greške.",
			};
		}
	});

export const revokeInvitation = safeActionClient
	.schema(revokeInvitationSchema)
	.action(async ({ parsedInput, ctx }) => {
		try {
			const invite = await prisma.clubInvite.findFirst({
				where: {
					id: parsedInput.inviteId,
					clubId: ctx.club.id,
					status: "PENDING",
				},
			});

			if (!invite) {
				throw new Error("Pozivnica nije pronađena ili je već iskorištena.");
			}

			await prisma.clubInvite.update({
				where: {
					id: parsedInput.inviteId,
				},
				data: {
					status: "REVOKED",
				},
			});

			revalidatePath(`/dashboard/${ctx.club.id}/members/invitations`);

			return {
				success: true,
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
				error: "Došlo je do neočekivane greške.",
			};
		}
	});
