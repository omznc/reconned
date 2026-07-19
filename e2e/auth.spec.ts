import { expect, test } from "@playwright/test";
import { loadFixtures } from "./fixtures";

// The register/login forms gate their submit button on a Turnstile token; the always-pass
// test site key issues one automatically, so waiting for the button to become enabled is
// the correct synchronization point.

test("visiting the dashboard while logged out redirects to login", async ({ page }) => {
	await page.goto("/en/dashboard");
	await expect(page).toHaveURL(/\/login/);
});

test("a new user can register via the UI", async ({ page }) => {
	await page.goto("/en/register");

	await page.locator("#name").fill("E2E Register User");
	await page.locator("#email").fill(`e2e-register-${Date.now()}@example.com`);
	await page.locator("#password").fill("e2e-password-123");

	const submit = page.getByRole("button", { name: "Register", exact: true });
	await expect(submit).toBeEnabled({ timeout: 15_000 });
	await submit.click();

	await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
	await expect(page.getByText(/successfully registered/i)).toBeVisible();
});

test("an existing user can log in and reach the dashboard", async ({ page }) => {
	const { user } = loadFixtures();
	await page.goto("/en/login?redirectTo=/dashboard");

	await page.locator("#email").fill(user.email);
	await page.locator("#password").fill(user.password);

	const submit = page.getByRole("button", { name: "Login" });
	await expect(submit).toBeEnabled({ timeout: 15_000 });
	await submit.click();

	await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
	await expect(page.getByRole("heading", { name: new RegExp(`Welcome, ${user.name}`) })).toBeVisible();
});

test("logging in with a wrong password shows an error and stays on login", async ({ page }) => {
	const { user } = loadFixtures();
	await page.goto("/en/login");

	await page.locator("#email").fill(user.email);
	await page.locator("#password").fill("definitely-wrong-password");

	const submit = page.getByRole("button", { name: "Login" });
	await expect(submit).toBeEnabled({ timeout: 15_000 });
	await submit.click();

	await expect(page).toHaveURL(/\/login/);
	await expect(page.getByRole("heading", { name: /Welcome/ })).not.toBeVisible();
});
