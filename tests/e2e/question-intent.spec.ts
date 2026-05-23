import { test, expect } from "@playwright/test";

test.describe("Question intent gate", () => {
  test("what is a CRM does not start build workflow", async ({ page }) => {
    await page.goto("/create");
    if (page.url().includes("/auth/login")) {
      test.skip(true, "Requires .playwright-auth.json");
    }
    const textarea = page.locator("textarea").first();
    await textarea.fill("What is a CRM?");
    const buildBtn = page.locator("[data-create-build-btn]").first();
    if ((await buildBtn.count()) === 0) {
      test.skip(true, "Create build button not on page");
    }
    await buildBtn.click();
    await page.waitForTimeout(2000);
    expect(page.url()).not.toMatch(/\/apps\/[a-f0-9-]+\/builder/);
  });
});
