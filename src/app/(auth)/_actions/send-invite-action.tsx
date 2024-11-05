import { env } from "@/lib/env";
import { resend } from "@/lib/resend";
import { InviteEmailTemplate } from "@components/invite-email-template";

export async function sendInviteAction({
	to,
	from = "Airsoft BiH <airsoft@safetpojskic.com>",
	subject,
	name,
	inviteLink,
}: {
	to: string;
	from?: string;
	subject: string;
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
			from,
			to,
			subject,
			react: InviteEmailTemplate({
				name,
				email: to,
				inviteLink: url.toString(),
			}),
		});

		if (error) {
			throw new Error(error.message);
		}

		return data;
	} catch (error) {
		console.error(error);
	}
}
