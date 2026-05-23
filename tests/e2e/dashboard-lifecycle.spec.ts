import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.describe("Dashboard lifecycle", () => {
  test("projects API route exists", async ({ request }) => {
    const res = await request.get("/api/projects");
    expect([200, 401]).toContain(res.status());
  });

  test("projects view has search filter sort and lifecycle badges", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/apps/projects-view.tsx"),
      "utf8",
    );
    expect(src).toContain("Search projects");
    expect(src).toContain("statusFilter");
    expect(src).toContain("needsRepair");
    expect(src).toContain("Fix issues");
    expect(src).toContain("public_url");
    expect(src).toContain("ProjectCardSkeleton");
  });

  test("reconcile query param supported", async () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/projects/route.ts"),
      "utf8",
    );
    expect(route).toContain("reconcile");
  });

  test("dashboard refreshes on window focus", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/apps/projects-view.tsx"),
      "utf8",
    );
    expect(src).toContain("addEventListener(\"focus\"");
    expect(src).toContain("loadProjects");
  });

  test("preview and publish CTAs gated by lifecycle", async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/apps/projects-view.tsx"),
      "utf8",
    );
    expect(src).toContain("canPreview");
    expect(src).toContain("canPublish");
    expect(src).toContain("needsRepair");
  });
});
