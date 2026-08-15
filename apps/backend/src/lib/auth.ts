import { apiKey } from "@better-auth/api-key";
import { passkey } from "@better-auth/passkey";
import { render } from "@react-email/components";
import { betterAuth, logger } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, captcha, lastLoginMethod, mcp, oneTap, openAPI, twoFactor } from "better-auth/plugins";
import { emailHarmony } from "better-auth-harmony";
import { and, eq, gt } from "drizzle-orm";
import { clubInvite, clubMembership } from "../drizzle/schema";
import EmailVerification from "../emails/email-verification";
import PasswordReset from "../emails/password-reset";
import { userAdditionalFields } from "./auth-fields";
import { bustRouteCache, clubMembershipCacheKeys } from "./cache-bust";
import { CLEAR_ARCHIVE } from "./club-access";
import { db } from "./db";
import { getEmailMessages } from "./email-messages";
import { env } from "./env";
import { sendEmail } from "./mail";
import { posthog } from "./posthog";
import { redis } from "./redis";

interface UserWithLanguage {
	id: string;
	email: string;
	name: string;
	emailVerified: boolean;
	image?: string | null;
	language?: "en" | "bs" | "sr";
}

const appUrl = new URL(env.FRONTEND_URL);

/**
 * Maps the better-auth endpoint that triggered a database hook to an analytics
 * method label. Paths are better-auth route patterns, e.g. "/sign-in/email",
 * "/one-tap/callback", "/callback/:id" (social OAuth, provider in params).
 */
function authMethodFromPath(path: string | undefined, params: Record<string, string | undefined> | undefined) {
	if (!path) {
		return "unknown";
	}
	if (path.includes("one-tap")) {
		return "google-one-tap";
	}
	if (path.startsWith("/callback") || path.startsWith("/oauth2/callback")) {
		return params?.id ?? "oauth";
	}
	if (path.includes("passkey")) {
		return "passkey";
	}
	if (path.includes("two-factor")) {
		return "two-factor";
	}
	if (path.startsWith("/sign-up") || path.startsWith("/sign-in/email")) {
		return "email";
	}
	return path;
}

export const auth = betterAuth({
	telemetry: { enabled: false },
	rateLimit: { enabled: false },
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	// Keep OAuth codes & other verification values in Postgres even though
	// secondaryStorage is configured — a Redis blip must not invalidate them.
	verification: {
		storeInDatabase: true,
	},
	session: {
		freshAge: 0,
		storeSessionInDatabase: true,
		// Signed session snapshot in the cookie, so a normal request validates locally instead of
		// paying a Redis round-trip. Tradeoff: a revoked/banned session, or a role change, stays
		// live for up to `maxAge` seconds — keep this short.
		cookieCache: {
			enabled: true,
			maxAge: 60,
		},
	},
	secondaryStorage: {
		get: async (key) => {
			try {
				return await redis.get(key);
			} catch {
				return null;
			}
		},
		set: async (key: string, value: string, ttl?: number) => {
			try {
				if (ttl) {
					await redis.setex(key, ttl, value);
				}
			} catch {
				// fallback to DB storage
			}
		},
		delete: async (key) => {
			try {
				await redis.del(key);
			} catch {
				// best effort
			}
		},
		getAndDelete: async (key) => {
			try {
				return await redis.getdel(key);
			} catch {
				return null;
			}
		},
	},
	experimental: { joins: true },
	trustedOrigins: (() => {
		const origins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim());
		const trustedOrigins = [...origins, env.FRONTEND_URL];
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
		requireEmailVerification: process.env.NODE_ENV !== "development",
		sendResetPassword: async ({ user, url }) => {
			const logoUrl = `${env.FRONTEND_URL}/logo.png`;
			const userWithLanguage = user as UserWithLanguage;
			const language = userWithLanguage.language || "bs";
			const messages = getEmailMessages(language);

			await sendEmail({
				to: user.email,
				subject: messages.emails.passwordReset.subject,
				html: await render(
					PasswordReset({
						userName: user.name,
						resetUrl: url,
						logoUrl,
						language,
					}),
					{
						pretty: true,
					},
				),
			});

			posthog.capture({
				distinctId: user.id,
				event: "password_reset_email_sent",
				properties: {
					language,
				},
			});
		},
	},
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			const redirectUrl = `${env.FRONTEND_URL}/login`;
			const verificationUrl = new URL(url);
			const logoUrl = `${env.FRONTEND_URL}/logo.png`;

			if (!verificationUrl.pathname.startsWith("/api/auth/")) {
				verificationUrl.pathname = `/api/auth${verificationUrl.pathname}`;
			}

			if (verificationUrl.searchParams.has("callbackURL")) {
				verificationUrl.searchParams.set("callbackURL", redirectUrl);
			} else {
				verificationUrl.searchParams.append("callbackURL", redirectUrl);
			}

			const userWithLanguage = user as UserWithLanguage;
			const language = userWithLanguage.language || "bs";
			const messages = getEmailMessages(language);

			await sendEmail({
				to: user.email,
				subject: messages.emails.emailVerification.subject,
				html: await render(
					EmailVerification({
						userName: user.name,
						verificationUrl: verificationUrl.toString(),
						logoUrl,
						language,
					}),
					{
						pretty: true,
					},
				),
			});

			posthog.capture({
				distinctId: user.id,
				event: "email_verification_sent",
				properties: {
					language,
				},
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
			rpID: appUrl.hostname,
			rpName: "Reconned",
		}),
		twoFactor({
			issuer: "Reconned",
			backupCodeOptions: {
				storeBackupCodes: "plain",
				amount: 8,
				length: 10,
			},
		}),
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
		oneTap(),
		openAPI(),
		apiKey({
			defaultPrefix: "rec_",
			enableSessionForAPIKeys: true,
			rateLimit: { enabled: false },
		}),
		mcp({
			loginPage: "/sign-in",
		}),
	],
	user: {
		additionalFields: userAdditionalFields,
	},
	databaseHooks: {
		user: {
			create: {
				after: async (user, ctx) => {
					posthog.capture({
						distinctId: user.id,
						event: "user_signed_up",
						properties: {
							method: authMethodFromPath(ctx?.path, ctx?.params),
						},
					});
				},
			},
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
									const updatedInvite = await tx
										.update(clubInvite)
										.set({
											status: "ACCEPTED",
											userId: user.id,
										})
										.where(and(eq(clubInvite.id, invite.id), eq(clubInvite.status, "PENDING")))
										.returning();

									if (updatedInvite.length === 0) {
										return;
									}

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

									const priorMembership = existingMembership[0];

									if (!priorMembership) {
										await tx.insert(clubMembership).values({
											id: crypto.randomUUID(),
											userId: user.id,
											clubId: invite.clubId,
											role: "USER",
											createdAt: new Date().toISOString(),
											updatedAt: new Date().toISOString(),
										});
									} else if (priorMembership.status === "ARCHIVED") {
										// Accepting a fresh invite brings an archived membership back.
										await tx
											.update(clubMembership)
											.set({
												...CLEAR_ARCHIVE,
												role: "USER",
												updatedAt: new Date().toISOString(),
											})
											.where(eq(clubMembership.id, priorMembership.id));
									}
								});

								// The club just gained a member, but this runs from an auth hook rather
								// than a club route, so nothing busts the roster cache for us.
								await bustRouteCache(clubMembershipCacheKeys(invite.clubId));
							} catch (error) {
								logger.error(`Failed to process invite ${invite.id}:`, { error });
							}
						}
					}
				},
			},
		},
		session: {
			create: {
				after: async (session, ctx) => {
					// Session creation covers every login flow (email, social, one tap,
					// passkey); sign-ups also land here via autoSignIn, which is fine —
					// a first sign-in is still a sign-in.
					posthog.capture({
						distinctId: session.userId,
						event: "user_signed_in",
						properties: {
							method: authMethodFromPath(ctx?.path, ctx?.params),
						},
					});
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
