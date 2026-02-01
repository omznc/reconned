import { env } from "./env";
import { logger, posthog } from "./posthog";

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

	const url = "https://onesignal.com/api/v1/notifications";

	const startTime = Date.now();
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Basic ${env.ONESIGNAL_API_KEY.substring(0, 10)}...`,
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

	logger.emit({
		severityText: response.ok ? "info" : "error",
		body: "OneSignal API call: send_email",
		attributes: {
			url,
			method: "POST",
			status_code: response.status,
			duration_ms: duration,
			success: response.ok,
			recipient_count: recipients.length,
			subject,
		},
	});

	if (!response.ok) {
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

	return (await response.json()) as { MessageId: string };
}
