import { env } from "./env";
import { posthog } from "./posthog";

type SendEmailParams = {
	to: string | string[];
	subject: string;
	html: string;
	from?: string;
};

export async function sendEmail({ to, subject, html }: SendEmailParams) {
	const recipients = Array.isArray(to) ? to : [to];

	// Track email sending
	posthog.capture({
		distinctId: "system",
		event: "email_sent",
		properties: {
			recipient_count: recipients.length,
			subject: subject,
			has_html: Boolean(html),
		},
	});

	const response = await fetch("https://onesignal.com/api/v1/notifications", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Basic ${env.ONESIGNAL_API_KEY}`,
		},
		body: JSON.stringify({
			app_id: env.ONESIGNAL_APP_ID,
			include_email_tokens: recipients,
			email_subject: subject,
			email_body: html,
			channel_for_external_user_ids: "email",
		}),
	});

	if (!response.ok) {
		throw new Error(`OneSignal API error: ${response.statusText}`);
	}

	return (await response.json()) as { MessageId: string };
}
