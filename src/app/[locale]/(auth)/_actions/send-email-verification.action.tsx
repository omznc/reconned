import { render } from "@react-email/components";
import { getExtracted } from "next-intl/server";
import EmailVerification from "@/emails/email-verification";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mail";

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
	const t = await getExtracted();

	if (!url.pathname.startsWith("/api/auth/")) {
		url.pathname = `/api/auth${url.pathname}`;
	}

	if (url.searchParams.has("callbackURL")) {
		url.searchParams.set("callbackURL", redirectUrl);
	} else {
		url.searchParams.append("callbackURL", redirectUrl);
	}

	try {
		const resp = await sendEmail({
			to,
			subject: t("Confirm your email"),
			html: await render(<EmailVerification userName={name} verificationUrl={url.toString()} />, {
				pretty: true,
			}),
		});

		return resp.MessageId;
	} catch (_) {
		return null;
	}
}
