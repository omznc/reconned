import { expect, test } from "@playwright/test";
import { loadFixtures } from "./fixtures";

// Runs as the pre-authenticated "authed" project user. The fixture event (created in
// global-setup) has open registrations and allows freelancers, so a club-less user can
// apply solo.

test("events list shows the fixture event and links to its detail page", async ({ page }) => {
	const { event } = loadFixtures();

	// The list is served from a revalidating cache; a stale-while-revalidate response can
	// briefly predate the fixture, so reload until the fresh render lands.
	await expect(async () => {
		await page.goto("/en/events");
		await expect(page.getByText(event.name).first()).toBeVisible({ timeout: 2_000 });
	}).toPass({ timeout: 30_000 });

	await page.getByText(event.name).first().click();

	await expect(page).toHaveURL(/\/events\//);
	await expect(page.getByRole("heading", { level: 1, name: event.name })).toBeVisible();
});

test("a logged-in user can apply to an event solo", async ({ page }) => {
	const { event } = loadFixtures();
	await page.goto(`/en/events/${event.id}/apply`);

	// Step 1: application type — selecting solo auto-advances the wizard.
	await page.getByRole("button", { name: /solo/i }).first().click();

	// Step 2: details.
	await page.getByRole("button", { name: "Next", exact: true }).click();

	// Step 3: accept the event rules.
	await page.locator("#rules").check();
	await page.getByRole("button", { name: "Next", exact: true }).click();

	// Step 4: payment (cash tab is the default).
	await page.getByRole("button", { name: "Submit application" }).click();

	await expect(page.getByText(/Successfully applied to event/i)).toBeVisible({ timeout: 15_000 });
	await expect(page).toHaveURL(/\/events\//, { timeout: 15_000 });
});
