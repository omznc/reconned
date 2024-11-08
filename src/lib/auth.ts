import { sendEmailVerificationAction } from "@/app/(auth)/_actions/send-email-verification.action";
import PasswordReset from "@/emails/password-reset";
import { clubs } from "@/lib/auth-plugins/clubs";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { DEFAULT_FROM, resend } from "@/lib/resend";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { oneTap, passkey } from "better-auth/plugins";

import { headers } from "next/headers";
import { cache } from "react";

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
		clubs(),
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
	const allHeaders = await headers();
	const [session, managedClubs] = await Promise.all([
		auth.api.getSession({
			headers: allHeaders,
		}),
		auth.api
			.getManagedClubs({
				headers: allHeaders,
			})
			.then((res) => res)
			.catch(() => []),
	]);
	return {
		...session?.user,
		managedClubs,
	};
});
