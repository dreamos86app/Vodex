import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  MOBILE_WIDTHS,
  assertNoOverflow,
  checkHorizontalOverflow,
} from "./helpers/mobile-layout";

const PUBLIC_ROUTES = [
  { path: "/create", label: "create funnel" },
];

const AUTH_ROUTES = [
  { path: "/dashboard", label: "dashboard hub" },
  { path: "/projects", label: "apps grid" },
  { path: "/settings/billing", label: "billing" },
  { path: "/admin/competitive", label: "competitive admin" },
];

test.describe("Mobile layout — public routes", () => {
  for (const route of PUBLIC_ROUTES) {
    for (const width of MOBILE_WIDTHS) {
      test(`${route.label} no overflow @ ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(route.path, { waitUntil: "domcontentloaded" });
        if (route.path === "/create" && page.url().includes("/auth/login")) {
          testInfo.skip(true, "Create requires auth for funnel overflow check");
        }
        await assertNoOverflow(page, { ...route, width }, testInfo);
      });
    }
  }
});

test.describe("Mobile layout — structure checks", () => {
  test("create funnel has sticky safe-area action bar", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/create/premium-create-funnel.tsx"),
      "utf8",
    );
    expect(src).toContain("safe-area-pad-b");
    expect(src).toContain("create-funnel-root");
  });

  test("projects view has dashboard-shell overflow guard", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/apps/projects-view.tsx"),
      "utf8",
    );
    expect(src).toContain("dashboard-shell");
  });

  test("builder has mobile panel switcher", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/builder/app-builder-workspace.tsx"),
      "utf8",
    );
    expect(src).toMatch(/mobilePanel|builder-mobile-panel/);
  });

  test("credit estimate hides provider jargon", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/create/create-credit-estimate.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/gpt-|claude|openai|provider cost/i);
    expect(src).not.toMatch(/sk_live|service_role/i);
  });
});

test.describe("Mobile layout — auth routes", () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    const authPath = path.join(process.cwd(), ".playwright-auth.json");
    if (!fs.existsSync(authPath)) {
      testInfo.skip(true, "Requires .playwright-auth.json — run npm run setup:e2e-auth");
    }
  });

  for (const route of AUTH_ROUTES) {
    for (const width of MOBILE_WIDTHS) {
      test(`${route.label} no overflow @ ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(route.path, { waitUntil: "domcontentloaded" });
        if (page.url().includes("/auth/login")) {
          test.skip(true, "Auth session expired");
        }
        await assertNoOverflow(page, { ...route, width }, testInfo);
      });
    }
  }
});

test.describe("Mobile layout — quick smoke", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("create page primary CTA visible", async ({ page }) => {
    await page.goto("/create", { waitUntil: "domcontentloaded" });
    if (page.url().includes("/auth/login")) {
      test.skip(true, "Create requires auth — run npm run setup:e2e-auth for live create UI proof");
    }
    const btn = page.locator("[data-create-build-btn]");
    await expect(btn).toBeVisible({ timeout: 10000 });
    const box = await btn.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.y + box.height).toBeLessThanOrEqual(844 + 2);
    }
    const overflow = await checkHorizontalOverflow(page);
    expect(overflow).toBeFalsy();
  });
});
