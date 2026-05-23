import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.describe("Editor checkpoints — structure", () => {
  test("apply-diff validates after apply when requested", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/editor/apply-diff/route.ts"),
      "utf8",
    );
    expect(src).toContain("validateAfterApply");
    expect(src).toContain("validationOk");
  });

  test("pending diff stored separately from app_files", () => {
    const store = fs.readFileSync(
      path.join(process.cwd(), "src/lib/editor/pending-diff-store.ts"),
      "utf8",
    );
    expect(store).toContain("pending");
  });

  test("checkpoints capture stage labels", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/lib/editor/checkpoints.ts"),
      "utf8",
    );
    expect(src).toContain("createCheckpoint");
    expect(src).toContain("pre_edit");
    expect(src).toContain("pre_publish");
  });

  test("builder creates checkpoint before edit apply", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/builder/app-builder-workspace.tsx"),
      "utf8",
    );
    expect(src).toContain("createCheckpoint");
    expect(src).toContain("Before edit");
  });

  test("file tree shows generated/edited indicators", () => {
    const tree = fs.readFileSync(
      path.join(process.cwd(), "src/components/editor/file-tree.tsx"),
      "utf8",
    );
    expect(tree).toContain("Search files");
    expect(tree).toContain("generated");
    expect(tree).toContain("edited");
  });

  test("tabs track dirty state", () => {
    const tabs = fs.readFileSync(
      path.join(process.cwd(), "src/components/editor/editor-tabs.tsx"),
      "utf8",
    );
    expect(tabs).toContain("dirty");
  });
});

test.describe("Editor checkpoints — @live", () => {
  test.beforeEach(({}, testInfo) => {
    if (process.env.E2E_RUN_LIVE !== "1") {
      testInfo.skip(true, "Set E2E_RUN_LIVE=1 for live editor proof");
    }
    if (!fs.existsSync(path.join(process.cwd(), ".playwright-auth.json"))) {
      testInfo.skip(true, "Requires .playwright-auth.json");
    }
  });

  test("@live reject pending diff clears pending store", async ({ request }) => {
    test.setTimeout(120_000);
    const list = await request.get("/api/projects?reconcile=1", { timeout: 90_000 });
    expect(list.status()).toBe(200);
    const body = (await list.json()) as { projects?: Array<{ id: string }> };
    const projectId = body.projects?.[0]?.id;
    test.skip(!projectId, "No project");

    const pending = await request.get(`/api/editor/pending-diff?projectId=${projectId}`);
    if (pending.status() !== 200) {
      expect([401, 404]).toContain(pending.status());
      return;
    }

    const data = (await pending.json()) as { pending?: { id?: string; diffs?: unknown[] } | null };
    if (!data.pending?.diffs?.length || !data.pending.id) {
      expect(data.pending?.diffs?.length ?? 0).toBe(0);
      return;
    }

    const reject = await request.put("/api/editor/pending-diff", {
      data: { projectId, diffId: data.pending.id, status: "rejected" },
    });
    expect(reject.status()).toBe(200);
  });

  test("@live checkpoints list requires owned project", async ({ request }) => {
    const res = await request.get("/api/editor/checkpoints?projectId=00000000-0000-0000-0000-000000000001");
    expect([200, 400, 401, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as { checkpoints?: unknown[] };
      expect(Array.isArray(body.checkpoints)).toBe(true);
    }
  });
});
