/**
 * The API returns two different error shapes: the router's own validation and rate-limit
 * responses use `{ error: "some message" }`, while anything thrown as an AppError is
 * serialised as `{ error: { code, message, details } }`. The generated OpenAPI types only
 * describe the first one, so reading `error.error` straight into a toast renders
 * "[object Object]" for every error the route handlers actually throw.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
	const message = extractMessage(error);
	return message ?? fallback;
}

function extractMessage(error: unknown): string | null {
	if (typeof error === "string") {
		return error.trim() || null;
	}

	if (!error || typeof error !== "object") {
		return null;
	}

	if (error instanceof Error) {
		return error.message.trim() || null;
	}

	const record = error as Record<string, unknown>;

	if (typeof record.message === "string" && record.message.trim()) {
		return record.message.trim();
	}

	if ("error" in record) {
		return extractMessage(record.error);
	}

	return null;
}
