import { render } from "@react-email/components";
import { betterAuth, logger } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, captcha, createAuthMiddleware, lastLoginMethod, oneTap, twoFactor } from "better-auth/plugins";
import { passkey } from "better-auth/plugins/passkey";
import { emailHarmony } from "better-auth-harmony";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import posthog from "posthog-js";
import { cache } from "react";
import { sendEmailVerificationAction } from "@/app/[locale]/(auth)/_actions/send-email-verification.action";
import { fetchManagedClubs } from "@/app/api/club/managed/fetch-managed-clubs";
import PasswordReset from "@/emails/password-reset";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mail";
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
			const t = await getTranslations("auth");
			await sendEmail({
				to: user.email,
				subject: t("resetPasswordSubject"),
				html: await render(<PasswordReset userName={user.name} resetUrl={url} />, {
					pretty: true,
				}),
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
			backupCodeOptions: {
				storeBackupCodes: "encrypted",
				amount: 8,
				length: 10,
			},
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
			endpoints: ["/sign-up/email", "/sign-in/email"],
		}),
		lastLoginMethod(),
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
						const pendingInvites = await prisma.clubInvite.findMany({
							where: {
								email: user.email,
								status: "PENDING",
								expiresAt: {
									gt: new Date(),
								},
							},
							include: {
								club: true,
							},
						});

						for (const invite of pendingInvites) {
							try {
								await prisma.$transaction(async (tx) => {
									// Update the invite status to ACCEPTED and link to the user
									await tx.clubInvite.update({
										where: { id: invite.id },
										data: {
											status: "ACCEPTED",
											userId: user.id,
										},
									});

									// Check if the user already has a membership in this club
									const existingMembership = await tx.clubMembership.findFirst({
										where: {
											userId: user.id,
											clubId: invite.clubId,
										},
									});

									// Create membership if it doesn't exist
									if (!existingMembership) {
										await tx.clubMembership.create({
											data: {
												userId: user.id,
												clubId: invite.clubId,
												role: "USER",
											},
										});
									}
								});
							} catch (error) {
								logger.error(`Failed to process invite ${invite.id}:`, { error });
							}
						}
					}
				},
			},
			create: {
				after: async (user) => {
					const t = await getTranslations("auth");

					if (env.NTFY_ENDPOINT) {
						await fetch(env.NTFY_ENDPOINT, {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								title: t("newUserSignedUp"),
								message: `User ${user.name} (${user.email}) signed up.`,
							}),
						});
					}
				},
			},
		},
	},
	hooks: {
		after: createAuthMiddleware(async (ctx) => {
			if (!ctx.context.newSession?.user) {
				return;
			}

			posthog.identify(ctx.context.newSession?.user.id, {
				email: ctx.context.newSession?.user.email,
				name: ctx.context.newSession?.user.name,
			});
		}),
	},
});

type IsAuthenticatedProps = {
	bypassCache?: boolean;
};

export const isAuthenticated = cache(async (props?: IsAuthenticatedProps) => {
	const allHeaders = await headers();

	const session = await auth.api.getSession({
		headers: allHeaders,
		query: {
			disableCookieCache: props?.bypassCache,
		},
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
