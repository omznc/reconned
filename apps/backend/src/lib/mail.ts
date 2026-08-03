import { env } from "./env";
import { logger } from "./posthog";

type SendEmailParams = {
	to: string | string[];
	subject: string;
	html: string;
	from?: string;
};

/**
 * How many times a send is attempted before it is given up on. A OneSignal blip or a dropped
 * connection used to lose the mail outright, which for something like a waitlist promotion means
 * the person never learns they have a place.
 */
const SEND_ATTEMPTS = 3;

/** Only worth retrying what might succeed next time. A rejected payload will be rejected again. */
function isRetryable(error: unknown) {
	if (error instanceof MailApiError) {
		return error.status >= 500 || error.status === 429;
	}

	// Anything that never reached OneSignal: DNS, connection reset, timeout.
	return true;
}

class MailApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "MailApiError";
	}
}

export async function sendEmail(params: SendEmailParams) {
	let lastError: unknown;

	for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt++) {
		try {
			return await attemptSend(params);
		} catch (error) {
			lastError = error;

			if (attempt === SEND_ATTEMPTS || !isRetryable(error)) {
				throw error;
			}

			logger.emit({
				severityText: "warn",
				body: "Retrying email send",
				attributes: {
					attempt,
					subject: params.subject,
					error: error instanceof Error ? error.message : String(error),
				},
			});

			await Bun.sleep(250 * 2 ** (attempt - 1));
		}
	}

	throw lastError;
}

async function attemptSend({ to, subject, html }: SendEmailParams) {
	const recipients = Array.isArray(to) ? to : [to];

	// Test environments have no real OneSignal credentials; a thrown send error would fail the
	// surrounding flow (e.g. sign-up awaits the verification email).
	if (process.env.EMAIL_DISABLED === "true") {
		logger.emit({
			severityText: "info",
			body: "Email sending disabled, skipping",
			attributes: { recipient_count: recipients.length, subject },
		});
		return { MessageId: "email-disabled" };
	}

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
	throw new MailApiError(`OneSignal API error: ${response.statusText}`, response.status);
}

/**
 * Runs work that the caller's response does not depend on, without holding the response open for
 * it. Mail is the case this exists for: whoever just registered should not wait on OneSignal, and
 * a bounce must not read as a failed registration.
 *
 * Errors are logged rather than thrown, since there is nobody left to throw to by then.
 */
export function detach(label: string, work: () => Promise<void>) {
	void work().catch((error) => {
		logger.emit({
			severityText: "error",
			body: "Detached work failed",
			attributes: {
				label,
				error: error instanceof Error ? error.message : String(error),
			},
		});
	});
}
