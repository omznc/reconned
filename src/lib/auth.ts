import { sendEmailVerificationAction } from "@/app/(auth)/_actions/send-email-verification.action";
import PasswordReset from "@/emails/password-reset";
import { env } from "@/lib/env";
import { DEFAULT_FROM, resend } from "@/lib/resend";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { oneTap, passkey } from "better-auth/plugins";
import { headers } from "next/headers";
import { cache } from "react";

const prisma = new PrismaClient();
export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async (user, url) => {
			await resend.emails.send({
				from: DEFAULT_FROM,
				to: user.email,
				subject: "Resetujte svoju lozinku",
				react: PasswordReset({
					userName: user.name,
					resetUrl: url,
				}),
			});
		},
	},
	emailVerification: {
		sendVerificationEmail: async (user, url) => {
			await sendEmailVerificationAction({
				to: user.email,
				name: user.name,
				inviteLink: url,
			});
		},
		sendOnSignUp: true,
	},
	socialProviders: {
		google: {
			clientId: env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string,
			clientSecret: env.GOOGLE_CLIENT_SECRET as string,
		},
	},
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["google"],
		},
	},
	plugins: [
		passkey({
			rpName: "Airsoft BiH",
		}),
		oneTap(),
	],
	databaseHooks: {
		user: {
			update: {
				after: async (user) => {
					if (user.emailVerified) {
						const pendingInvite = await prisma.clubInvite.findFirst({
							where: {
								email: user.email,
								status: "PENDING",
								userId: null,
								expiresAt: {
									gt: new Date(),
								},
							},
						});

						if (pendingInvite) {
							// Link the invite to the verified user
							await prisma.clubInvite.update({
								where: { id: pendingInvite.id },
								data: {
									userId: user.id,
								},
							});
						}
					}
				},
			},
		},
	},
});

export const isAuthenticated = cache(async () => {
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	return session?.user;
});
