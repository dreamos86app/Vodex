import { test, expect } from "@playwright/test";

test.describe("Preview runtime", () => {
  test("preview start route file exists", async () => {
    const fs = await import("fs");
    const path = await import("path");
    expect(
      fs.existsSync(path.join(process.cwd(), "src/app/api/projects/[id]/preview/start/route.ts")),
    ).toBeTruthy();
  });

  test("preview blocked without auth", async ({ request }) => {
    const res = await request.post(
      "/api/projects/00000000-0000-0000-0000-000000000001/preview/start",
    );
    expect([401, 400, 404]).toContain(res.status());
  });

  test("preview status route requires sessionId", async ({ request }) => {
    const res = await request.get(
      "/api/projects/00000000-0000-0000-0000-000000000001/preview/status",
    );
    expect([400, 401, 404]).toContain(res.status());
  });

  test("preview logs route requires sessionId", async ({ request }) => {
    const res = await request.get(
      "/api/projects/00000000-0000-0000-0000-000000000001/preview/logs",
    );
    expect([400, 401, 404]).toContain(res.status());
  });

  test("preview page route exists", async () => {
    const fs = await import("fs");
    const path = await import("path");
    expect(fs.existsSync(path.join(process.cwd(), "src/app/preview/[previewId]/page.tsx"))).toBeTruthy();
  });

  test("no fake preview URL in build completion", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/lib/build/complete-build-with-validation.ts"),
      "utf8",
    );
    expect(src).toContain('lifecycle = "generated"');
    expect(src).toContain("preview_ready: false");
  });

  test("vercel provider honest not_connected", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/lib/preview/vercel-preview-provider.ts"),
      "utf8",
    );
    expect(src).toContain("not_connected");
    expect(src).toContain("needs_project_link");
  });
});
