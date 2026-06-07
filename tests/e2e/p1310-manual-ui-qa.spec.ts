import { test, expect } from "./helpers/live-gate";
import { finalizeArtifact, writeP138Artifact, type P138StepResult } from "./helpers/p138-artifacts";
import { resolveGeneratedProjectId } from "./helpers/resolve-generated-project";

test.describe.configure({ mode: "serial", timeout: 90_000 });

let projectId = "";

test.describe("P1.3.10 — Auth page QA @live", () => {
  const steps: P138StepResult[] = [];

  test.afterAll(() => {
    writeP138Artifact("manual-auth-page-qa.json", finalizeArtifact(steps, projectId || null));
  });

  test.beforeAll(async ({ request, liveGate }) => {
    if (!liveGate) return;
    const p = await resolveGeneratedProjectId(request);
    if (p) projectId = p.id;
  });

  test("auth dashboard layout", async ({ page, liveGate }) => {
    if (!liveGate || !projectId) return;
    const id = "auth_page";
    try {
      await page.goto(`/apps/${projectId}/builder?tab=dashboard&section=auth`, {
        waitUntil: "commit",
        timeout: 60_000,
      });
      await expect(page.getByTestId("app-dashboard-panel")).toBeVisible({ timeout: 30_000 });
      const center = page.getByTestId("app-auth-center");
      await expect(center.getByTestId("auth-provider-row-email")).toBeVisible({ timeout: 25_000 });
      await expect(center.getByText(/Gmail \/ Email/i)).toBeVisible();
      await expect(center.getByText(/Phone number/i)).toBeVisible();
      await expect(center.getByText(/Custom OAuth/i)).toBeVisible();
      expect(await center.getByText(/Show advanced auth settings/i).count()).toBe(0);
      steps.push({ id, pass: true });
    } catch (err) {
      steps.push({ id, pass: false, root_cause: String(err) });
      throw err;
    }
  });
});

test.describe("P1.3.10 — Watermark QA @live", () => {
  const steps: P138StepResult[] = [];

  test.afterAll(() => {
    writeP138Artifact("manual-watermark-qa.json", finalizeArtifact(steps, projectId || null));
  });

  test("settings watermark only", async ({ page, liveGate }) => {
    if (!liveGate || !projectId) return;
    const id = "watermark_settings";
    try {
      await page.goto(`/apps/${projectId}/builder?tab=dashboard&section=settings`, {
        waitUntil: "commit",
        timeout: 60_000,
      });
      await expect(page.getByTestId("app-dashboard-panel")).toBeVisible({ timeout: 25_000 });
      const panel = page.getByTestId("app-settings-dashboard-panel");
      await expect(panel).toBeVisible({ timeout: 20_000 });
      expect(await panel.getByText(/^Branding$/i).count()).toBe(0);
      await expect(panel.getByText(/^Watermark$/i)).toBeVisible();
      await expect(panel.getByRole("link", { name: "Made with Vodex" })).toBeVisible();
      steps.push({ id, pass: true });
    } catch (err) {
      steps.push({ id, pass: false, root_cause: String(err) });
      throw err;
    }
  });
});

test.describe("P1.3.10 — Apps menu QA @live", () => {
  const steps: P138StepResult[] = [];

  test.afterAll(() => {
    writeP138Artifact("manual-apps-menu-qa.json", finalizeArtifact(steps, null));
  });

  test("apps overflow menu", async ({ page, liveGate }) => {
    if (!liveGate) return;
    const id = "apps_menu";
    try {
      await page.goto("/projects", { waitUntil: "domcontentloaded", timeout: 30_000 });
      await expect(page.getByTestId("apps-sectioned-list")).toBeVisible({ timeout: 30_000 });
      const menu = page.getByTestId("project-card-overflow-menu").first();
      await expect(menu).toBeVisible({ timeout: 15_000 });
      await menu.click();
      const dropdown = page.getByTestId("project-card-overflow-dropdown");
      await expect(dropdown).toBeVisible({ timeout: 5_000 });
      for (const label of ["Open builder", "Share", "Rename", "Clone app", "Delete"]) {
        await expect(dropdown.getByText(label, { exact: false })).toBeVisible();
      }
      steps.push({ id, pass: true });
    } catch (err) {
      steps.push({ id, pass: false, root_cause: String(err) });
      throw err;
    }
  });
});

test.describe("P1.3.10 — Mobile + overlay QA @live", () => {
  const steps: P138StepResult[] = [];

  test.afterAll(() => {
    writeP138Artifact("manual-mobile-overlay-qa.json", finalizeArtifact(steps, projectId || null));
  });

  test.beforeAll(async ({ request, liveGate }) => {
    if (!liveGate) return;
    const p = await resolveGeneratedProjectId(request);
    if (p) projectId = p.id;
  });

  test("mobile setup skeleton", async ({ page, liveGate }) => {
    if (!liveGate || !projectId) return;
    const id = "mobile_setup";
    try {
      await page.goto(`/apps/${projectId}/builder?tab=mobile`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await expect(page.getByTestId("workspace-composer-textarea")).toBeVisible({ timeout: 25_000 });
      const studio = page.getByTestId("mobile-wrapper-studio").or(page.getByTestId("mobile-setup-skeleton"));
      await expect(studio.first()).toBeVisible({ timeout: 15_000 });
      steps.push({ id, pass: true });
    } catch (err) {
      steps.push({ id, pass: false, root_cause: String(err) });
      throw err;
    }
  });

  test("toast above modal z-index tokens", async ({ page, liveGate }) => {
    if (!liveGate) return;
    const id = "overlay_z";
    try {
      await page.goto("/projects", { waitUntil: "load", timeout: 60_000 });
      await page.waitForFunction(
        () =>
          getComputedStyle(document.documentElement).getPropertyValue("--z-critical-alert").trim() ===
          "1000",
        { timeout: 15_000 },
      );
      const css = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--z-critical-alert").trim(),
      );
      expect(css).toBe("1000");
      steps.push({ id, pass: true, detail: `--z-critical-alert=${css}` });
    } catch (err) {
      steps.push({ id, pass: false, root_cause: String(err) });
      throw err;
    }
  });
});
