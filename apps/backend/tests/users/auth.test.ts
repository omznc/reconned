import { describe, expect, test } from "bun:test";
import { CAPTCHA_HEADER, createUser } from "../helpers/auth";
import { api } from "../helpers/client";
import { BASE_URL } from "../helpers/env";

describe("authentication", () => {
	test("sign-up creates a user and yields a session cookie", async () => {
		const user = await createUser();
		expect(user.id).not.toBe("");
		expect(user.cookie).toContain("session_token");
	});

	test("sign-in with a wrong password is rejected", async () => {
		const user = await createUser();
		const response = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
			method: "POST",
			headers: { "content-type": "application/json", ...CAPTCHA_HEADER },
			body: JSON.stringify({ email: user.email, password: "definitely-wrong-password" }),
		});
		expect(response.status).toBe(401);
	});

	test("sign-up without a captcha token is rejected", async () => {
		const response = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				name: "No Captcha",
				email: `test-${crypto.randomUUID()}@example.com`,
				password: "test-password-123",
			}),
		});
		expect(response.status).toBeGreaterThanOrEqual(400);
	});

	test("protected route returns 401 without a session and 200 with one", async () => {
		const anonymous = await api().get("/api/users/me/clubs");
		expect(anonymous.status).toBe(401);

		const user = await createUser();
		const authed = await api(user.cookie).get("/api/users/me/clubs");
		expect(authed.status).toBe(200);
	});
});
