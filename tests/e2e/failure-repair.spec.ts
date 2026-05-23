import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test.describe("failure repair coverage (structure)", () => {
  test("repair classifier covers required failure types", () => {
    const src = fs.readFileSync(path.join(root, "src/lib/repair/repair-classifier.ts"), "utf8");
    for (const t of [
      "migration_missing",
      "preview_failed",
      "build_failed",
      "validation_failed",
      "publish_failed",
      "missing_env",
      "insufficient_credits",
      "stale_lifecycle",
      "vercel_not_connected",
      "generated_placeholder",
      "no_files",
      "provider_cap_hit",
    ]) {
      expect(src).toContain(t);
    }
  });

  test("AI repair reserves credits and checkpoints", () => {
    const src = fs.readFileSync(path.join(root, "src/lib/repair/run-user-ai-repair.ts"), "utf8");
    expect(src).toContain("reserveCreditsForGeneration");
    expect(src).toContain("saveProjectCheckpoint");
    expect(src).toContain("reconcileGenerationReservation");
  });

  test("migration repair exposes SQL file path", () => {
    const actions = fs.readFileSync(path.join(root, "src/lib/repair/repair-actions.ts"), "utf8");
    expect(actions).toContain("dreamos-runtime-repair.sql");
    expect(fs.existsSync(path.join(root, "scripts/dreamos-runtime-repair.sql"))).toBeTruthy();
  });

  test("insufficient credits opens billing path", () => {
    const actions = fs.readFileSync(path.join(root, "src/lib/repair/repair-actions.ts"), "utf8");
    expect(actions).toContain("/settings/billing");
  });

  test("vercel not connected shows connect instructions", () => {
    const classifier = fs.readFileSync(path.join(root, "src/lib/repair/repair-classifier.ts"), "utf8");
    expect(classifier).toMatch(/Integrations/i);
    const actions = fs.readFileSync(path.join(root, "src/lib/repair/repair-actions.ts"), "utf8");
    expect(actions).toContain("/settings/integrations");
  });

  test("repair route validates project id in source", () => {
    const route = fs.readFileSync(path.join(root, "src/app/api/projects/[id]/repair/route.ts"), "utf8");
    expect(route).toContain("requireProjectId");
    expect(route).toContain("requireMutationProjectId");
  });

  test("repair POST requires action body in source", () => {
    const route = fs.readFileSync(path.join(root, "src/app/api/projects/[id]/repair/route.ts"), "utf8");
    expect(route).toContain('action required');
    expect(route).toContain("requireAuthUser");
  });
});

test("@live repair reconcile on real project", async ({ request }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(process.env.E2E_RUN_LIVE !== "1", "Live E2E only");
  const list = await request.get("/api/projects?reconcile=1", { timeout: 90_000 });
  expect(list.status()).toBe(200);
  const body = await list.json();
  const id = body.projects?.[0]?.id;
  if (!id) {
    test.skip();
    return;
  }
  const repair = await request.get(`/api/projects/${id}/repair`, { timeout: 90_000 });
  expect(repair.status()).toBe(200);
  const payload = await repair.json();
  expect(Array.isArray(payload.issues)).toBeTruthy();
  expect(Array.isArray(payload.actions)).toBeTruthy();
  testInfo.annotations.push({ type: "repair", description: `issues=${payload.issues.length}` });
});
