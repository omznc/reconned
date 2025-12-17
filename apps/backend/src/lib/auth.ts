import { passkey } from "@better-auth/passkey";
import { render } from "@react-email/components";
import { betterAuth, logger } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, captcha, lastLoginMethod, oneTap, openAPI, twoFactor } from "better-auth/plugins";
import { emailHarmony } from "better-auth-harmony";
import { and, eq, gt } from "drizzle-orm";
import { clubInvite, clubMembership } from "../drizzle/schema";
import EmailVerification from "../emails/email-verification";
import PasswordReset from "../emails/password-reset";
import { db } from "./db";
import { env } from "./env";
import { sendEmail } from "./mail";
import { redis } from "./redis";

type SecondaryStorage = {
	get: (key: string) => Promise<unknown>;
	set: (key: string, value: string, ttl?: number) => Promise<void>;
	delete: (key: string) => Promise<void>;
};

export const auth = betterAuth({
	telemetry: { enabled: false },
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	secondaryStorage: {
		get: async (key: string) => await redis.get(key),
		set: async (key: string, value: string, ttl?: number) => {
			if (ttl) await redis.set(key, value, "EX", ttl);
			else await redis.set(key, value);
		},
		delete: async (key: string) => {
			await redis.del(key);
		},
	} satisfies SecondaryStorage,
	experimental: { joins: true },
	trustedOrigins: (() => {
		const origins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim());
		const trustedOrigins = [...origins];
		for (const origin of origins) {
			try {
				const url = new URL(origin);
				trustedOrigins.push(`${url.origin}/api/auth`);
			} catch {
				// Invalid URL, skip
			}
		}
		return trustedOrigins;
	})(),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) => {
			const logoUrl = `${env.BETTER_AUTH_URL}/logo.png`;
			await sendEmail({
				to: user.email,
				subject: "Reset your password",
				html: await render(PasswordReset({ userName: user.name, resetUrl: url, logoUrl }), {
					pretty: true,
				}),
			});
		},
	},
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			const redirectUrl = `${env.BETTER_AUTH_URL}/login`;
			const verificationUrl = new URL(url);
			const logoUrl = `${env.BETTER_AUTH_URL}/logo.png`;

			if (!verificationUrl.pathname.startsWith("/api/auth/")) {
				verificationUrl.pathname = `/api/auth${verificationUrl.pathname}`;
			}

			if (verificationUrl.searchParams.has("callbackURL")) {
				verificationUrl.searchParams.set("callbackURL", redirectUrl);
			} else {
				verificationUrl.searchParams.append("callbackURL", redirectUrl);
			}

			await sendEmail({
				to: user.email,
				subject: "Confirm your email",
				html: await render(
					EmailVerification({ userName: user.name, verificationUrl: verificationUrl.toString(), logoUrl }),
					{
						pretty: true,
					},
				),
			});
		},
		sendOnSignUp: true,
	},
	socialProviders: {
		google: {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
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
		openAPI(),
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
				required: false,
			},
			style: {
				type: "string",
				default: "relaxed",
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
						const pendingInvites = await db
							.select()
							.from(clubInvite)
							.where(
								and(
									eq(clubInvite.email, user.email),
									eq(clubInvite.status, "PENDING"),
									gt(clubInvite.expiresAt, new Date().toISOString()),
								),
							);

						for (const invite of pendingInvites) {
							try {
								await db.transaction(async (tx) => {
									await tx
										.update(clubInvite)
										.set({
											status: "ACCEPTED",
											userId: user.id,
										})
										.where(eq(clubInvite.id, invite.id));

									const existingMembership = await tx
										.select()
										.from(clubMembership)
										.where(
											and(
												eq(clubMembership.userId, user.id),
												eq(clubMembership.clubId, invite.clubId),
											),
										)
										.limit(1);

									if (existingMembership.length === 0) {
										await tx.insert(clubMembership).values({
											id: crypto.randomUUID(),
											userId: user.id,
											clubId: invite.clubId,
											role: "USER",
											createdAt: new Date().toISOString(),
											updatedAt: new Date().toISOString(),
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
		},
	},
});

export type AuthUser = {
	id: string;
	email: string;
	name: string;
	role?: string;
};

export type AuthSession = {
	id: string;
};

export type BetterAuthContext = {
	user?: AuthUser;
	session?: AuthSession;
};
