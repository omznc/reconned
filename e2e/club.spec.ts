import { expect, test } from "@playwright/test";

// Runs as the pre-authenticated "authed" project user (storage state from global-setup).

test("a logged-in user can create a club from the dashboard", async ({ page }) => {
	const clubName = `E2E UI Club ${Date.now()}`;
	await page.goto("/en/dashboard/add-club?type=new");

	await page.getByPlaceholder("Veis").fill(clubName);

	// Country is a radix combobox: open the popover, search, pick the match.
	await page.getByRole("button", { name: "Country*" }).click();
	await page.getByPlaceholder(/Search countries/).fill("Bosnia");
	await page
		.getByRole("option", { name: /Bosnia/ })
		.first()
		.click();

	await page.getByPlaceholder("Livno").fill("Sarajevo");

	await page.getByRole("button", { name: "Create" }).click();

	await expect(page).toHaveURL(/\/dashboard\/[^/]+\/club/, { timeout: 20_000 });

	await page.goto("/en/dashboard");
	await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
	// The created club appears in the dashboard club switcher.
	await expect(page.getByText(clubName).first()).toBeVisible();
});
