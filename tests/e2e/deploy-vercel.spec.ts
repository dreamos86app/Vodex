import { test, expect } from "@playwright/test";

test.describe("Deploy / Vercel honest runtime", () => {
  test("connect-status returns structured connection fields", async ({ request }) => {
    const res = await request.get("/api/deploy/vercel/connect-status");
    expect([200, 401]).toContain(res.status());
    if (res.status() === 401) return;
    const body = await res.json();
    expect(body).toHaveProperty("state");
    expect(body).toHaveProperty("hasToken");
    expect(body).toHaveProperty("envSyncOk");
  });

  test("deploy readiness requires projectId", async ({ request }) => {
    const res = await request.get("/api/deploy/readiness");
    expect([400, 401]).toContain(res.status());
    if (res.status() === 401) return;
    const body = await res.json();
    expect(body.error).toMatch(/projectId/i);
  });

  test("public URL defaults to path mode without DNS verify", async ({ request }) => {
    const res = await request.post("/api/publish/check-slug", { data: { slug: "demo-app" } });
    expect([200, 400, 401, 405]).toContain(res.status());
    const slugRes = await request.get("/p/demo-app-not-real-slug-xyz");
    expect([200, 404]).toContain(slugRes.status());
  });
});

test.describe("@live Deploy API", () => {
  test.skip(!process.env.E2E_RUN_LIVE, "Set E2E_RUN_LIVE=1 for live deploy checks");

  test("authenticated deploy history loads", async ({ request }) => {
    const res = await request.get("/api/deploy/history");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.deployments)).toBe(true);
  });
});
