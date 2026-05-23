import { test, expect } from "@playwright/test";
import { checkHorizontalOverflow } from "./helpers/mobile-layout";

test.describe("Mobile create", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("create page has no horizontal overflow", async ({ page }) => {
    await page.goto("/create");
    const overflow = await checkHorizontalOverflow(page);
    expect(overflow).toBeFalsy();
  });

  test("create sticky CTA is visible", async ({ page }) => {
    await page.goto("/create");
    const btn = page.locator("[data-create-build-btn]");
    await expect(btn).toBeVisible();
  });
});
