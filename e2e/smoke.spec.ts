import { expect, test } from "@playwright/test";

// Public pages render without crashing, in both the explicit `en` locale and the
// default (prefixless) locale.

test("home page renders", async ({ page }) => {
	const response = await page.goto("/en");
	expect(response?.status()).toBeLessThan(400);
	await expect(page.locator("body")).toBeVisible();
});

test("home page renders in the default locale", async ({ page }) => {
	const response = await page.goto("/");
	expect(response?.status()).toBeLessThan(400);
	await expect(page.locator("body")).toBeVisible();
});

test("public clubs page renders", async ({ page }) => {
	const response = await page.goto("/en/clubs");
	expect(response?.status()).toBeLessThan(400);
	await expect(page.getByRole("heading", { level: 1, name: "Clubs" })).toBeVisible();
});

test("public events page renders", async ({ page }) => {
	const response = await page.goto("/en/events");
	expect(response?.status()).toBeLessThan(400);
	await expect(page.getByRole("heading", { level: 1, name: "Upcoming events" })).toBeVisible();
});
