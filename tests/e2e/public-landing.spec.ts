import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Public landing — structure", () => {
  test("conversion cards and how-it-works demo render", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("public-landing")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("public-conversion-cards")).toBeVisible();
    await expect(page.getByTestId("how-it-works-demo")).toBeVisible();
    await expect(page.getByTestId("dreamos-stats-section")).toBeVisible();
    await expect(page.getByTestId("why-dreamos-section")).toBeVisible();
    await expect(page.getByText("DreamOS86 in numbers")).toBeVisible();
    await expect(page.getByText("From idea to live app")).toBeVisible();
    await expect(page.getByText("Template gallery")).toHaveCount(0);
    await expect(page.getByText("Controlled AI cost")).toHaveCount(0);
    await expect(page.getByText("Pricing at a glance")).toHaveCount(0);
  });

  test("no horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("public-landing")).toBeVisible({ timeout: 15_000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    );
    expect(overflow).toBe(false);
  });

  test("Get Started opens auth path", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("public-hero-continue").click();
    await expect(page.getByTestId("public-auth-signup")).toBeVisible();
  });
});
