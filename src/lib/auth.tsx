import { sendEmailVerificationAction } from "@/app/(auth)/_actions/send-email-verification.action";
import { fetchManagedClubs } from "@/app/api/club/managed/fetch-managed-clubs";
import PasswordReset from "@/emails/password-reset";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mail";
import { PrismaClient } from "@prisma/client";
import { render } from "@react-email/components";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, oneTap, twoFactor } from "better-auth/plugins";
import { passkey } from "better-auth/plugins/passkey";

import { headers } from "next/headers";
import { cache } from "react";

const prisma = new PrismaClient();

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	trustedOrigins: [
		"http://localhost:3000",
		"https://localhost:3000",
		"https://airsoft-bih.vercel.app",
		"https://airsoft-bih.vercel.app/api/auth",
		"https://reconned.com",
		"https://reconned.com/api/auth",
	],
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: "Resetujte svoju lozinku",
				html: await render(<PasswordReset userName={user.name} resetUrl={url} />, {
					pretty: true,
				})
			});
		},
	},
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
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
		passkey(),
		twoFactor({
			issuer: "Airsoft BIH",
		}),
		oneTap(),
		admin({
			defaultRole: "user",
		}),
	],
	user: {
		additionalFields: {
			isAdmin: {
				type: "boolean",
				default: false,
				input: false,
				required: false,
			},
			callsign: {
				type: "string",
				default: "",
				input: true,
				required: false,
			},
		},
	},
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
			// On create send an event to plausible
			create: {
				after: async (user) => {
					await fetch("https://scout.reconned.com/api/event", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"User-Agent": "Reconned",
							Authorization: `Bearer ${env.PLAUSIBLE_API_KEY}`
						},
						body: JSON.stringify({
							name: "signup",
							url: "https://reconned.com/register",
							domain: "reconned.com",
							properties: {
								distinct_id: user.id,
								email: user.email,
								name: user.name,
							}
						}),
					});
				},
			},
		},
	},
});


export const isAuthenticated = cache(async () => {
	const allHeaders = await headers();

	const session = await auth.api.getSession({
		headers: allHeaders,
	});

	if (!session?.user.id) {
		return null;
	}

	const managedClubs = await fetchManagedClubs(session.user.id);

	return {
		...session?.user,
		managedClubs,
		session: session?.session,
	};
});
