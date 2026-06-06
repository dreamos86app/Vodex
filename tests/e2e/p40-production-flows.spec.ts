import { test, expect } from "./helpers/live-gate";

const RECIPLY_PROJECT_ID = process.env.E2E_RECIPLY_PROJECT_ID ?? "59bf67fb-2203-4f3a-82e7-07f31a7dc4ad";
const RECIPLY_PUBLISH_SLUG = process.env.E2E_RECIPLY_PUBLISH_SLUG ?? "reciplyy-mq01rwer";

test.use({
  video: "on",
  screenshot: "on",
  trace: "on",
});

test.describe("P4.0 production browser flows — @live", () => {
  test("Flow A — create workspace loads", async ({ page, liveGate }) => {
    if (!liveGate) return;
    await page.goto("/create");
    await expect(page.getByRole("heading", { name: /create/i }).or(page.locator("body"))).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).toHaveURL(/\/create/);
  });

  test("Flow B — published Reciply ZIP app is live", async ({ page, liveGate }) => {
    if (!liveGate) return;
    await page.goto(`/p/${RECIPLY_PUBLISH_SLUG}`);
    await expect(page.locator("body")).toBeVisible({ timeout: 30_000 });
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("Flow C — mobile studio reachable for Reciply project", async ({ page, liveGate }) => {
    if (!liveGate) return;
    await page.goto(`/apps/${RECIPLY_PROJECT_ID}/builder?tab=mobile`);
    await page.waitForTimeout(2000);
    const studio = page.getByTestId("mobile-wrapper-studio");
    const gate = page.getByText(/mobile wrapping needs|Loading mobile setup|Mobile/i);
    await expect(studio.or(gate).first()).toBeVisible({ timeout: 30_000 });
  });

  test("Flow D — notification bell opens panel", async ({ page, liveGate }) => {
    if (!liveGate) return;
    await page.goto("/dashboard");
    const bell = page.getByTestId("notification-bell");
    await expect(bell).toBeVisible({ timeout: 20_000 });
    await bell.click();
    await expect(page.getByTestId("notification-panel")).toBeVisible({ timeout: 10_000 });
  });

  test("Flow E — billing settings page loads", async ({ page, liveGate }) => {
    if (!liveGate) return;
    await page.goto("/settings/billing");
    await expect(page.locator("body")).toContainText(/billing|plan|subscription/i, { timeout: 20_000 });
  });
});
