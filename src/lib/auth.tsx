import { sendEmailVerificationAction } from "@/app/[locale]/(auth)/_actions/send-email-verification.action";
import { fetchManagedClubs } from "@/app/api/club/managed/fetch-managed-clubs";
import PasswordReset from "@/emails/password-reset";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mail";
import { render } from "@react-email/components";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, captcha, oneTap, twoFactor } from "better-auth/plugins";
import { passkey } from "better-auth/plugins/passkey";
import { getLocale } from "next-intl/server";
import { emailHarmony } from "better-auth-harmony";

import { headers } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 60 * 5, // 5 minutes
		},
	},
	trustedOrigins: [
		"http://localhost:3000",
		"https://localhost:3000",
		"https://reconned.com",
		"https://reconned.com/api/auth",
		"https://beta.reconned.com",
		"https://beta.reconned.com/api/auth",
	],
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: "Resetujte svoju lozinku",
				html: await render(
					<PasswordReset userName={user.name} resetUrl={url} />,
					{
						pretty: true,
					},
				),
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
		passkey({
			rpID: "reconned.com",
			rpName: "Reconned",
		}),
		twoFactor({
			issuer: "Reconned",
		}),
		oneTap(),
		admin({
			defaultRole: "user",
		}),
		emailHarmony({
			allowNormalizedSignin: true,
		}),
		captcha({
			provider: "cloudflare-turnstile",
			secretKey: env.TURNSTILE_SECRET_KEY,
			endpoints: ["/sign-up", "/sign-in", "/forget-password"],
		}),
	],
	user: {
		additionalFields: {
			callsign: {
				type: "string",
				default: "",
				input: true,
				required: false,
			},
			language: {
				type: "string",
				default: "bs",
				input: true,
				required: false,
			},
			font: {
				type: "string",
				default: "sans",
				input: true,
				required: false,
			},
			theme: {
				type: "string",
				default: "dark",
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
					await fetch(`${env.PLAUSIBLE_HOST}/api/event`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"User-Agent": "Reconned",
							Authorization: `Bearer ${env.PLAUSIBLE_API_KEY}`,
						},
						body: JSON.stringify({
							name: "signup",
							url: "https://reconned.com/register",
							domain: "reconned.com",
							properties: {
								distinct_id: user.id,
								email: user.email,
								name: user.name,
							},
						}),
					});
					const locale = await getLocale();
					await prisma.user.update({
						where: {
							id: user.id,
						},
						data: {
							language: locale,
						},
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
