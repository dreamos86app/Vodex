import { test, expect } from "./helpers/live-gate";
import { finalizeArtifact, writeP138Artifact, type P138StepResult } from "./helpers/p138-artifacts";
import { resolveGeneratedProjectId } from "./helpers/resolve-generated-project";

test.describe.configure({ mode: "serial", timeout: 90_000 });

const steps: P138StepResult[] = [];
let projectId = "";

async function openBuilder(page: import("@playwright/test").Page, tab?: string) {
  const qs = tab ? `?tab=${tab}` : "";
  await page.goto(`/apps/${projectId}/builder${qs}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page.getByTestId("workspace-composer-textarea")).toBeVisible({ timeout: 25_000 });
  if (tab === "preview") {
    const previewTab = page.getByRole("button", { name: /^Preview$/i });
    if ((await previewTab.count()) > 0) await previewTab.first().click();
  }
}

test.describe("P1.3.10 — Northly generated app manual QA @live", () => {
  test.beforeAll(async ({ request, liveGate }) => {
    if (!liveGate) return;
    const resolved = await resolveGeneratedProjectId(request);
    if (!resolved) throw new Error("No generated project with files for E2E user");
    projectId = resolved.id;
  });

  test.afterAll(() => {
    writeP138Artifact("manual-northly-qa.json", finalizeArtifact(steps, projectId || null));
  });

  test("A — build state truth", async ({ page, liveGate }) => {
    if (!liveGate) return;
    try {
      await openBuilder(page);
      const summary = page.getByTestId("build-run-summary");
      if ((await summary.count()) > 0) {
        const text = await summary.innerText();
        expect(text).not.toMatch(/Couldn't start the build/i);
      }
      steps.push({ id: "A_build_state", pass: true });
    } catch (err) {
      steps.push({ id: "A_build_state", pass: false, root_cause: String(err) });
      throw err;
    }
  });

  test("B — file diff stream", async ({ page, liveGate }) => {
    if (!liveGate) return;
    try {
      await openBuilder(page);
      const stream = page.getByTestId("agent-workflow-stream");
      if ((await stream.count()) > 0) {
        const text = await stream.innerText();
        const hasCounts = /\+\d+\s*-?\d*/.test(text) || (await page.getByTestId("workflow-file-diff-summary").count()) > 0;
        expect(hasCounts || /Created |Modified /.test(text)).toBeTruthy();
      }
      steps.push({ id: "B_file_diff", pass: true });
    } catch (err) {
      steps.push({ id: "B_file_diff", pass: false, root_cause: String(err) });
      throw err;
    }
  });

  test("C — clean description", async ({ request, liveGate }) => {
    if (!liveGate) return;
    try {
      const res = await request.get("/api/projects?reconcile=1");
      const body = (await res.json()) as { projects?: Array<{ id: string; short_description?: string; description?: string }> };
      const p = body.projects?.find((x) => x.id === projectId);
      const desc = p?.short_description ?? p?.description ?? "";
      expect(desc).not.toMatch(/Build execution plan|compressed\)/i);
      steps.push({ id: "C_description", pass: true, detail: desc.slice(0, 80) });
    } catch (err) {
      steps.push({ id: "C_description", pass: false, root_cause: String(err) });
      throw err;
    }
  });

  test("D — preview fit", async ({ page, liveGate }) => {
    if (!liveGate) return;
    try {
      await openBuilder(page, "preview");
      const canvas = page.getByTestId("preview-fit-canvas");
      if ((await canvas.count()) > 0) {
        await expect(canvas).toBeVisible();
      }
      expect(await page.getByText(/Preview embed blocked/i).count()).toBe(0);
      steps.push({ id: "D_preview", pass: true });
    } catch (err) {
      steps.push({ id: "D_preview", pass: false, root_cause: String(err) });
      throw err;
    }
  });

  test("E — dashboard health not catastrophic", async ({ page, liveGate }) => {
    if (!liveGate) return;
    try {
      await page.goto(`/apps/${projectId}/builder?tab=dashboard&section=overview`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      const overview = page.getByTestId("overview-dashboard-panel");
      if ((await overview.count()) > 0) {
        const text = await overview.innerText();
        expect(text).not.toMatch(/Couldn't start the build/i);
      }
      steps.push({ id: "E_dashboard_health", pass: true });
    } catch (err) {
      steps.push({ id: "E_dashboard_health", pass: false, root_cause: String(err) });
      throw err;
    }
  });
});
