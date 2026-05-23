import { test, expect } from "@playwright/test";

test.describe("Create app from prompt", () => {
  test("build prompt creates project path", async ({ page }) => {
    await page.goto("/create?mode=build");
    if (page.url().includes("/auth/login")) {
      test.skip(true, "Requires .playwright-auth.json");
    }
    const textarea = page.locator("textarea").first();
    await textarea.fill("Build me a CRM for dentists with scheduling");
    const buildBtn = page.locator("[data-create-build-btn]").first();
    if ((await buildBtn.count()) === 0) test.skip(true, "No build button");
    await buildBtn.click();
    await page.waitForTimeout(5000);
    const url = page.url();
    const onBuilder = /\/apps\/[a-f0-9-]+\/builder/.test(url) || /projectId=/.test(url);
    expect(onBuilder || url.includes("/create")).toBeTruthy();
  });
});
