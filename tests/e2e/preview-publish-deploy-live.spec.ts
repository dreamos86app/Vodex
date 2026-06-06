import { test, expect } from "./helpers/live-gate";
import { appendTestEvidence } from "./helpers/evidence";
import fs from "node:fs";
import path from "node:path";

test.describe("Preview / publish / deploy — structure", () => {
  test("preview blocked before generated in build completion", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/lib/build/complete-build-with-validation.ts"),
      "utf8",
    );
    expect(src).toContain("preview_ready: false");
    expect(src).not.toMatch(/preview_ready:\s*true/);
  });

  test("preview service gates on lifecycle + validator", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/lib/preview/preview-build-service.ts"),
      "utf8",
    );
    expect(src).toContain("PREVIEW_ELIGIBLE");
    expect(src).toContain("uiQualityBlocksGenerated");
    expect(src).toContain("preview_honest");
  });

  test("publish requires preview_honest + snapshot", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/lib/publish/publish-readiness.ts"),
      "utf8",
    );
    expect(src).toContain("preview_honest");
    expect(src).toContain("snapshotExists");
  });

  test("publish service verifies published_apps row", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/lib/publish/publish-service.ts"),
      "utf8",
    );
    expect(src).toContain("publish_verify_failed");
    expect(src).toContain("snapshot_files");
  });

  test("public route resolves published HTML not live app_files", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/app/p/[slug]/[[...path]]/route.ts"),
      "utf8",
    );
    expect(src).toContain("resolvePublishedAppHtml");
    expect(src).not.toMatch(/from\s+["']@\/lib\/supabase\/client["']/);
    expect(src).not.toContain("app_files");
  });

  test("no fake subdomain without DNS verify", async () => {
    const cfg = fs.readFileSync(path.join(process.cwd(), "src/lib/publish/publish-config.ts"), "utf8");
    expect(cfg).toContain("DREAMOS_DNS_VERIFIED");
    expect(cfg).toContain("DREAMOS_WILDCARD_SUBDOMAIN");
  });

  test("Vercel deploy stores URL only from provider", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/deploy/vercel/start/route.ts"),
      "utf8",
    );
    expect(src).toContain("createVercelDeployment");
    expect(src).toContain("deployment_url: deploymentUrl");
    expect(src).toContain("token_invalid");
    expect(src).toContain("missing_env");
  });

  test("Vercel connection honest states", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/lib/deploy/vercel-connection.ts"),
      "utf8",
    );
    expect(src).toContain("not_connected");
    expect(src).toContain("token_invalid");
    expect(src).toContain("needs_project_link");
    expect(src).toContain("missing_env");
  });
});

test.describe("Preview / publish / deploy — @live", () => {
  test("@live preview blocked before generated project", async ({ request, liveGate }) => {
    if (!liveGate) return;
    const res = await request.post("/api/projects/00000000-0000-0000-0000-000000000001/preview/start");
    expect([400, 401, 404]).toContain(res.status());
    appendTestEvidence({ name: "preview blocked invalid project", passed: true, timestamp: new Date().toISOString() });
  });

  test("@live publish blocked invalid project", async ({ request, liveGate }) => {
    if (!liveGate) return;
    const res = await request.post("/api/projects/00000000-0000-0000-0000-000000000001/publish", {
      data: {},
    });
    expect([400, 401, 404, 403]).toContain(res.status());
    appendTestEvidence({ name: "publish blocked invalid project", passed: true, timestamp: new Date().toISOString() });
  });

  test("@live unpublished slug returns not found", async ({ request, liveGate }) => {
    if (!liveGate) return;
    const res = await request.get("/p/e2e-not-published-slug-xyz");
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const html = await res.text();
      expect(html.toLowerCase()).toMatch(/not (found|published|available)/);
    }
    appendTestEvidence({ name: "unpublished slug 404", passed: true, timestamp: new Date().toISOString() });
  });

  test("@live Vercel connect-status honest when no token", async ({ request, liveGate }) => {
    if (!liveGate) return;
    const res = await request.get("/api/deploy/vercel/connect-status");
    expect(res.status()).toBe(200);
    const data = (await res.json()) as { state?: string; hasToken?: boolean };
    if (!data.hasToken) {
      expect(["not_connected", "missing_env"]).toContain(data.state ?? "");
    }
    appendTestEvidence({
      name: "vercel honest not_connected",
      passed: true,
      timestamp: new Date().toISOString(),
    });
  });

  test("@live deploy blocked without valid connection", async ({ request, liveGate }) => {
    if (!liveGate) return;
    const conn = await request.get("/api/deploy/vercel/connect-status");
    const connData = (await conn.json()) as { state?: string };
    if (connData.state !== "ready") {
      const res = await request.post("/api/deploy/vercel/start", {
        data: { projectId: "00000000-0000-0000-0000-000000000001" },
      });
      expect([400, 401, 403, 404, 503]).toContain(res.status());
      appendTestEvidence({ name: "deploy blocked without connection", passed: true, timestamp: new Date().toISOString() });
    }
  });

  test("@live preview logs require sessionId", async ({ request, liveGate }) => {
    if (!liveGate) return;
    const res = await request.get("/api/projects/00000000-0000-0000-0000-000000000001/preview/logs");
    expect([400, 401, 404]).toContain(res.status());
    appendTestEvidence({ name: "preview logs guarded", passed: true, timestamp: new Date().toISOString() });
  });

  test("@live publish readiness API guarded", async ({ request, liveGate }) => {
    if (!liveGate) return;
    const res = await request.get("/api/projects/00000000-0000-0000-0000-000000000001/publish/readiness");
    expect([401, 404]).toContain(res.status());
    appendTestEvidence({ name: "publish readiness guarded", passed: true, timestamp: new Date().toISOString() });
  });
});
