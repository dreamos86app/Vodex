import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const IMPORT_ROUTE = path.join(process.cwd(), "src/app/api/projects/import-zip/route.ts");
const WIZARD = path.join(process.cwd(), "src/components/apps/zip-import-wizard.tsx");
const DASHBOARD = path.join(process.cwd(), "src/components/create/workspace/app-dashboard-panel.tsx");
const IMPORT_VIEW = path.join(process.cwd(), "src/components/import/imported-app-view.tsx");

test.describe("ZIP import system", () => {
  test("import API route uses zip-import-service and quality score", async () => {
    const src = fs.readFileSync(IMPORT_ROUTE, "utf8");
    expect(src).toContain("extractAndAnalyzeZip");
    expect(src).toContain('source: "zip_import"');
    expect(src).toContain("quality_score");
    expect(src).toContain("owner_id");
  });

  test("wizard posts to import-zip and refreshes Your Apps", async () => {
    const src = fs.readFileSync(WIZARD, "utf8");
    expect(src).toContain("/api/projects/import-zip");
    expect(src).toContain("qualityScore");
  });

  test("dashboard shows imported app view and gated actions", async () => {
    const src = fs.readFileSync(DASHBOARD, "utf8");
    expect(src).toContain("ImportedAppView");
    expect(src).toContain("zip_import");
    expect(src).toContain("Publish locked");
  });

  test("imported app view shows framework scripts env checklist", async () => {
    const src = fs.readFileSync(IMPORT_VIEW, "utf8");
    expect(src).toContain("framework");
    expect(src).toContain("quality");
    expect(src).toContain("routes");
  });

  test("Your Apps shows Imported ZIP badge", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/apps/projects-view.tsx"),
      "utf8",
    );
    expect(src).toContain("Imported ZIP");
    expect(src).toContain("zip_import");
  });

  test("zip import preview API exists", async ({ request }) => {
    const res = await request.post("/api/import/zip/preview");
    expect([400, 401, 415]).toContain(res.status());
  });

  test("import-zip rejects missing file", async ({ request }) => {
    const res = await request.post("/api/projects/import-zip");
    expect([400, 401]).toContain(res.status());
  });
});

test.describe("@live ZIP import live journey", () => {
  test.skip(process.env.E2E_RUN_LIVE !== "1", "Set E2E_RUN_LIVE=1");

  test("@live upload ZIP creates project in Your Apps", async ({ page, request }) => {
    const authPath = path.join(process.cwd(), ".playwright-auth.json");
    test.skip(!fs.existsSync(authPath), "Missing .playwright-auth.json");

    const zip = new JSZip();
    zip.file(
      "package.json",
      JSON.stringify({
        scripts: { dev: "next dev", build: "next build", start: "next start" },
        dependencies: { next: "16.0.0", react: "19.0.0" },
      }),
    );
    zip.file("app/page.tsx", "export default function Page() { return <main>E2E Import</main>; }");
    zip.file(".env.example", "NEXT_PUBLIC_APP_URL=\n");
    const buf = await zip.generateAsync({ type: "nodebuffer" });

    const storage = JSON.parse(fs.readFileSync(authPath, "utf8"));
    const cookies = storage.cookies ?? [];
    const cookieHeader = cookies.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join("; ");

    const res = await request.post("/api/projects/import-zip", {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
      multipart: {
        file: {
          name: "e2e-import.zip",
          mimeType: "application/zip",
          buffer: buf,
        },
        name: "E2E Import Test",
      },
    });

    if (res.status() === 401) {
      test.skip(true, "Auth cookies expired");
      return;
    }

    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { projectId?: string; redirectTo?: string };
    expect(body.projectId).toBeTruthy();

    const list = await request.get("/api/projects?reconcile=1", {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });
    expect(list.ok()).toBeTruthy();
    const projects = (await list.json()) as { projects?: Array<{ id: string; metadata?: Record<string, unknown> }> };
    const found = (projects.projects ?? []).find((p) => p.id === body.projectId);
    expect(found).toBeTruthy();
    expect((found?.metadata as { source?: string })?.source).toBe("zip_import");

    if (body.redirectTo) {
      await page.goto(body.redirectTo);
      await expect(page.getByText(/imported|framework|files/i).first()).toBeVisible({ timeout: 15000 });
    }
  });
});
