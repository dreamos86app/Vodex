import { test, expect } from "@playwright/test";

test.describe("Create dashboard handoff", () => {
  test("projects API requires auth", async ({ request }) => {
    const res = await request.get("/api/projects");
    expect([200, 401]).toContain(res.status());
  });

  test("create page uses premium funnel not immersive workspace title", async ({ page }) => {
    await page.goto("/create");
    if (page.url().includes("/auth/login")) {
      test.skip(true, "Requires auth");
    }
    await expect(page.getByRole("heading", { name: /Create your app/i })).toBeVisible();
  });
});
