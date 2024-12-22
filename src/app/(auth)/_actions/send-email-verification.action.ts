import EmailVerification from "@/emails/email-verification";
import { env } from "@/lib/env";
import { DEFAULT_FROM, resend } from "@/lib/resend";

export async function sendEmailVerificationAction({
	to,
	name,
	inviteLink,
}: {
	to: string;
	name: string;
	inviteLink: string;
}) {
	const redirectUrl = `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/login`;
	const url = new URL(inviteLink);

	if (!url.pathname.startsWith("/api/auth/")) {
		url.pathname = `/api/auth${url.pathname}`;
	}

	if (url.searchParams.has("callbackURL")) {
		url.searchParams.set("callbackURL", redirectUrl);
	} else {
		url.searchParams.append("callbackURL", redirectUrl);
	}

	try {
		const { data, error } = await resend.emails.send({
			from: DEFAULT_FROM,
			to,
			subject: "Verificirajte svoj email",
			react: EmailVerification({
				userName: name,
				verificationUrl: url.toString(),
			}),
		});

		if (error) {
			throw new Error(error.message);
		}

		return data;
	} catch (error) {
		console.error(error);
		return null;
	}
}
