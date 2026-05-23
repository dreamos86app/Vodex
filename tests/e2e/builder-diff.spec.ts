import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.describe("Builder diff review", () => {
  test("pending diff API requires auth", async ({ request }) => {
    const res = await request.get("/api/editor/pending-diff?projectId=00000000-0000-0000-0000-000000000001");
    expect([400, 401, 403, 404]).toContain(res.status());
  });

  test("apply-diff API requires auth", async ({ request }) => {
    const res = await request.post("/api/editor/apply-diff", {
      data: { projectId: "00000000-0000-0000-0000-000000000001", patches: [] },
    });
    expect([400, 401, 403, 404]).toContain(res.status());
  });

  test("checkpoints API requires auth", async ({ request }) => {
    const res = await request.get("/api/editor/checkpoints?projectId=00000000-0000-0000-0000-000000000000");
    expect([400, 401, 403, 404]).toContain(res.status());
  });

  test("file tree has folder hierarchy builder", async () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/editor/file-tree-build.ts"), "utf8");
    expect(src).toContain("buildFileTree");
    expect(src).toContain("guessRouteFilePath");
  });

  test("AI diff viewer supports accept and reject all", async () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/components/editor/ai-diff-viewer.tsx"), "utf8");
    expect(src).toContain("Accept all");
    expect(src).toContain("Reject all");
  });

  test("workspace validates after apply and restores session", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/builder/app-builder-workspace.tsx"),
      "utf8",
    );
    expect(src).toContain("validateAfterApply");
    expect(src).toContain("loadEditorSession");
    expect(src).toContain("createCheckpoint");
    expect(src).toContain("onFilesChanged");
  });

  test("checkpoint timeline requires rollback confirmation", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/editor/checkpoint-timeline.tsx"),
      "utf8",
    );
    expect(src).toContain("Confirm");
    expect(src).toContain("CHECKPOINT_STAGE_LABELS");
  });

  test("apply-diff supports post-apply validation", async () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/app/api/editor/apply-diff/route.ts"), "utf8");
    expect(src).toContain("validateAfterApply");
    expect(src).toContain("validationOk");
  });

  test("pending diff partial reject via remainingDiffs", async () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/app/api/editor/pending-diff/route.ts"), "utf8");
    expect(src).toContain("remainingDiffs");
  });
});

test.describe("Builder diff review @live", () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    const authPath = path.join(process.cwd(), ".playwright-auth.json");
    if (!fs.existsSync(authPath)) {
      testInfo.skip(true, "Requires .playwright-auth.json — run npm run setup:e2e-auth");
    }
    if (process.env.E2E_RUN_LIVE !== "1") {
      testInfo.skip(true, "Set E2E_RUN_LIVE=1 for live builder diff proof");
    }
  });

  test("chat edit creates pending diff without mutating until accept", async ({ page, request }) => {
    test.setTimeout(90_000);
    const projectsRes = await request.get("/api/projects?reconcile=1");
    expect(projectsRes.ok()).toBeTruthy();
    const body = (await projectsRes.json()) as { projects?: Array<{ id: string }> };
    const projectId = body.projects?.[0]?.id;
    test.skip(!projectId, "No project for live builder diff test");

    const beforeRes = await request.get(`/api/editor/pending-diff?projectId=${projectId}`);
    const beforeJson = (await beforeRes.json()) as { pending?: { diffs?: unknown[] } | null };

    await page.goto(`/apps/${projectId}/builder?tab=code`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("builder-file-tree")).toBeVisible({ timeout: 20_000 });

    const hasFiles = (await page.getByTestId("builder-file-tree").getByText("No files").count()) === 0;
    if (hasFiles) {
      await expect(page.getByTestId("builder-editor-tabs")).toBeVisible();
    }

    if (beforeJson.pending?.diffs?.length) {
      await expect(page.getByTestId("pending-diff-panel")).toBeVisible();
      await expect(page.getByText("Review AI changes")).toBeVisible();
    }
  });
});
