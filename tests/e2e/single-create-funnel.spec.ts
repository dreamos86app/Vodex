import { test, expect } from "@playwright/test";

test.describe("Single create funnel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/create");
    if (page.url().includes("/auth/login")) {
      test.skip(true, "Requires .playwright-auth.json — see scripts/verify-e2e.mjs");
    }
  });

  test("only one create shell — no duplicate guided panel", async ({ page }) => {
    await expect(page.getByText("Create your app")).toBeVisible();
    await expect(page.getByText("One guided path")).toBeVisible();
    const guidedHide = page.getByText("Hide guided steps");
    await expect(guidedHide).toHaveCount(0);
  });

  test("question does not show app created", async ({ page }) => {
    await page.getByPlaceholder(/Describe your app|CRM/i).fill("What is a CRM?");
    await page.getByRole("button", { name: /Continue/i }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText(/no app was created/i)).toBeVisible({ timeout: 10_000 });
  });
});
