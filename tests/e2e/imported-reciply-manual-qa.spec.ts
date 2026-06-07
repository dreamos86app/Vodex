import { test, expect } from "./helpers/live-gate";
import { classifyIntent } from "./helpers/journey-api";
import { finalizeArtifact, writeP138Artifact, type P138StepResult } from "./helpers/p138-artifacts";
import { resolveImportedProjectId } from "./helpers/resolve-imported-project";
import fs from "node:fs";
import path from "node:path";

test.describe.configure({ mode: "serial", timeout: 60_000 });

const steps: P138StepResult[] = [];
let projectId = "";
let projectName = "imported";

async function shot(page: import("@playwright/test").Page, testInfo: import("@playwright/test").TestInfo, name: string) {
  const p = testInfo.outputPath(name);
  try {
    await page.screenshot({ path: p, timeout: 8_000 });
  } catch {
    /* optional */
  }
  return p;
}

async function waitForBuilderWorkspace(page: import("@playwright/test").Page) {
  if ((await page.getByTestId("builder-project-recovery").count()) > 0) {
    await page.getByRole("button", { name: /Retry/i }).click();
  }
  await expect(page.getByTestId("workspace-composer-textarea")).toBeVisible({ timeout: 25_000 });
}

async function openBuilder(page: import("@playwright/test").Page, tab?: string) {
  const qs = tab ? `?tab=${tab}` : "";
  const url = `/apps/${projectId}/builder${qs}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
      break;
    } catch {
      await page.waitForTimeout(1000);
      if (attempt === 2) throw new Error(`openBuilder failed for ${url}`);
    }
  }
  await waitForBuilderWorkspace(page);
  if (tab === "preview") {
    const previewTab = page.getByRole("button", { name: /^Preview$/i });
    if ((await previewTab.count()) > 0) await previewTab.first().click();
  }
}

async function fillAndSend(page: import("@playwright/test").Page, text: string) {
  const textarea = page.getByTestId("workspace-composer-textarea");
  await textarea.fill(text);
  await page.getByTestId("workspace-composer-submit").click();
}

test.describe("P1.3.8 — imported Reciply manual QA @live", () => {
  test.beforeAll(async ({ request, liveGate }) => {
    if (!liveGate) return;
    const resolved = await resolveImportedProjectId(request);
    if (!resolved) throw new Error("No zip_import project for E2E user");
    projectId = resolved.id;
    projectName = resolved.name;
  });

  test.afterAll(() => {
    writeP138Artifact("manual-reciply-import-qa.json", finalizeArtifact(steps, projectId || null));
  });

  test("A — open imported project", async ({ page, liveGate }, testInfo) => {
    if (!liveGate) return;
    const id = "A_open_project";
    try {
      await openBuilder(page);
      expect(page.url()).not.toMatch(/\/auth\/login/);
      expect(await page.getByText(/Preview embed blocked/i).count()).toBe(0);
      expect(
        (await page.getByText(/Preview needs to be prepared/i).count()) > 0 ||
          (await page.locator('iframe[src*="preview"]').count()) > 0,
      ).toBeTruthy();
      steps.push({ id, pass: true, detail: projectName, screenshot: await shot(page, testInfo, "A.png") });
    } catch (err) {
      steps.push({ id, pass: false, root_cause: String(err), screenshot: await shot(page, testInfo, "A-fail.png") });
      throw err;
    }
  });

  test("B — Why is preview blocked? (question_only)", async ({ page, liveGate }, testInfo) => {
    if (!liveGate) return;
    const id = "B_why_preview_blocked";
    try {
      await openBuilder(page);
      await fillAndSend(page, "Why is preview blocked?");
      await expect(page.getByText("Why is preview blocked?")).toBeVisible({ timeout: 8_000 });
      await expect(page.getByText(/Thinking|Discuss/i).first()).toBeVisible({ timeout: 8_000 });
      expect(await page.getByText("Build this app").count()).toBe(0);
      expect(await page.getByText(/Choose a starting point/i).count()).toBe(0);
      steps.push({ id, pass: true, screenshot: await shot(page, testInfo, "B.png") });
    } catch (err) {
      steps.push({ id, pass: false, root_cause: String(err), screenshot: await shot(page, testInfo, "B-fail.png") });
      throw err;
    }
  });

  test("C — Fix preview blocked (repair, no blueprint)", async ({ page, liveGate }, testInfo) => {
    if (!liveGate) return;
    const id = "C_fix_preview_repair";
    try {
      await openBuilder(page);
      await fillAndSend(page, "Fix the preview blocked issue.");
      await expect(page.getByText(/Fix the preview blocked issue/i)).toBeVisible({ timeout: 8_000 });
      expect(await page.getByText("Build this app").count()).toBe(0);
      expect(await page.getByText(/Choose a starting point/i).count()).toBe(0);
      steps.push({ id, pass: true, screenshot: await shot(page, testInfo, "C.png") });
    } catch (err) {
      steps.push({ id, pass: false, root_cause: String(err), screenshot: await shot(page, testInfo, "C-fail.png") });
      throw err;
    }
  });

  test("D — Prepare imported app preview", async ({ page, liveGate }, testInfo) => {
    if (!liveGate) return;
    const id = "D_prepare_preview";
    try {
      await openBuilder(page, "preview");
      const iframe = page.locator('iframe[src*="preview"]');
      const btn = page
        .getByRole("button", { name: /Prepare imported app preview/i })
        .or(page.getByRole("button", { name: /Prepare imported app/i }));
      if ((await iframe.count()) > 0) {
        steps.push({ id, pass: true, detail: "preview_iframe_already_present", screenshot: await shot(page, testInfo, "D.png") });
        return;
      }
      if ((await btn.count()) > 0) {
        await btn.first().click();
        await expect(page.getByText(/prepar|queued|building|credit|Action Credits|Preview needs/i).first()).toBeVisible({
          timeout: 12_000,
        });
      } else {
        await expect(page.getByText(/Preview needs to be prepared/i)).toBeVisible({ timeout: 8_000 });
      }
      steps.push({ id, pass: true, screenshot: await shot(page, testInfo, "D.png") });
    } catch (err) {
      steps.push({ id, pass: false, root_cause: String(err), screenshot: await shot(page, testInfo, "D-fail.png") });
      throw err;
    }
  });

  test("E — What is a CRM? (question_only)", async ({ page, request, liveGate }, testInfo) => {
    if (!liveGate) return;
    const id = "E_what_is_crm";
    try {
      const intent = await classifyIntent(request, "What is a CRM?");
      expect(intent.body.shouldCreateProject).toBe(false);
      await page.goto("/create", { waitUntil: "domcontentloaded", timeout: 20_000 });
      const prompt = page.getByTestId("create-prompt-textarea").or(page.getByPlaceholder(/Describe/i));
      await prompt.first().fill("What is a CRM?");
      await page.getByTestId("create-continue-button").or(page.locator("[data-create-build-btn]")).first().click();
      await page.waitForTimeout(800);
      expect(page.url()).not.toMatch(/\/apps\/[a-f0-9-]+\/builder/);
      steps.push({ id, pass: true, screenshot: await shot(page, testInfo, "E.png") });
    } catch (err) {
      steps.push({ id, pass: false, root_cause: String(err), screenshot: await shot(page, testInfo, "E-fail.png") });
      throw err;
    }
  });

  test("F — Create a CRM app (project_build)", async ({ request, liveGate }) => {
    if (!liveGate) return;
    const id = "F_create_crm";
    try {
      const intent = await classifyIntent(request, "Create a CRM app.");
      expect(intent.body.shouldCreateProject).toBe(true);
      steps.push({ id, pass: true, detail: "classify-intent shouldCreateProject=true" });
    } catch (err) {
      steps.push({ id, pass: false, root_cause: String(err) });
      throw err;
    }
  });

  test("G — ZIP scan defers mobile packaging", async () => {
    const id = "G_zip_scan_classification";
    const classification = fs.readFileSync(
      path.join(process.cwd(), "src/lib/import/zip-scan-classification.ts"),
      "utf8",
    );
    const wizard = fs.readFileSync(path.join(process.cwd(), "src/components/apps/zip-import-wizard.tsx"), "utf8");
    expect(classification).toContain("mobile_packaging");
    expect(wizard).toContain("mobilePackagingLater");
    expect(wizard).toContain("webPreviewReady");
    steps.push({ id, pass: true });
  });
});
