import { SQL } from "bun";
import { BASE_URL, testEnv } from "./env";

export interface TestUser {
	id: string;
	email: string;
	password: string;
	name: string;
	cookie: string;
}

/** Any value passes: the backend runs with Cloudflare Turnstile's always-pass test secret. */
export const CAPTCHA_HEADER = { "x-captcha-response": "test-token" };

function cookieFromResponse(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.filter(Boolean)
		.join("; ");
}

/** Signs up (and if needed signs in) a fresh unique user, returning its session cookie. */
export async function createUser(overrides: { name?: string; password?: string } = {}): Promise<TestUser> {
	const email = `test-${crypto.randomUUID()}@example.com`;
	const password = overrides.password ?? "test-password-123";
	const name = overrides.name ?? `Test User ${crypto.randomUUID().slice(0, 8)}`;

	const signUpResponse = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
		method: "POST",
		headers: { "content-type": "application/json", ...CAPTCHA_HEADER },
		body: JSON.stringify({ name, email, password }),
	});
	if (!signUpResponse.ok) {
		throw new Error(`Sign-up failed (${signUpResponse.status}): ${await signUpResponse.text()}`);
	}
	const signUpBody = (await signUpResponse.json()) as { user?: { id: string } };

	let cookie = cookieFromResponse(signUpResponse);
	if (!cookie.includes("session_token")) {
		cookie = await signIn(email, password);
	}

	return { id: signUpBody.user?.id ?? "", email, password, name, cookie };
}

/** Direct DB access for state tests can't reach through the API (roles, expiries, bans). */
export const testDb = new SQL(testEnv.DATABASE_URL ?? "");

/**
 * Promotes a user to admin and returns a fresh session cookie. A new sign-in is required
 * because the session cookie caches the role claim — the old cookie keeps the old role
 * until the cache window expires.
 */
export async function makeAdmin(user: TestUser): Promise<TestUser> {
	await testDb.unsafe(`UPDATE "User" SET role = 'admin' WHERE id = '${user.id}'`);
	const cookie = await signIn(user.email, user.password);
	return { ...user, cookie };
}

/** Signs in with email/password and returns the session cookie. Throws on failure. */
export async function signIn(email: string, password: string): Promise<string> {
	const response = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
		method: "POST",
		headers: { "content-type": "application/json", ...CAPTCHA_HEADER },
		body: JSON.stringify({ email, password }),
	});
	if (!response.ok) {
		throw new Error(`Sign-in failed (${response.status}): ${await response.text()}`);
	}
	return cookieFromResponse(response);
}
