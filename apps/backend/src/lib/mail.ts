import { env } from "./env";
import { logger } from "./posthog";

type SendEmailParams = {
	to: string | string[];
	subject: string;
	html: string;
	from?: string;
};

export async function sendEmail({ to, subject, html }: SendEmailParams) {
	const recipients = Array.isArray(to) ? to : [to];
	const url = "https://onesignal.com/api/v1/notifications";

	const startTime = Date.now();
	const response = await fetch(url, {
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
	const duration = Date.now() - startTime;

	if (response.ok) {
		logger.emit({
			severityText: "info",
			body: "OneSignal API call: send_email",
			attributes: {
				url,
				method: "POST",
				status_code: response.status,
				duration_ms: duration,
				success: true,
				recipient_count: recipients.length,
				subject,
			},
		});

		return (await response.json()) as { MessageId: string };
	}

	const errorText = await response.text();
	logger.emit({
		severityText: "error",
		body: "OneSignal API error",
		attributes: {
			status_code: response.status,
			error: errorText,
			recipient_count: recipients.length,
		},
	});
	throw new Error(`OneSignal API error: ${response.statusText}`);
}
