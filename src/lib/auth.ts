import { sendEmailVerificationAction } from "@/app/(auth)/_actions/send-email-verification.action";
import { env } from "@/lib/env";
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
	},
	emailVerification: {
		sendVerificationEmail: async (user, url) => {
			await sendEmailVerificationAction({
				to: user.email,
				subject: "Verify your email address",
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
});

export const isAuthenticated = cache(async () => {
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	return session?.user;
});
