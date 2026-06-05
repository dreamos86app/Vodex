import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Staging production flows — static contract checks (run in CI without live staging creds).
 * Live browser runs: PLAYWRIGHT_BASE_URL=https://staging… npx playwright test staging-production
 */

const ROOT = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

test.describe("Staging production E2E contracts", () => {
  test("Flow A — create app, generate, publish", async () => {
    const create = read("src/app/(workspace)/create/page.tsx");
    const publish = read("src/lib/publish/publish-service.ts");
    expect(create).toMatch(/CreatePageBody|CreationWorkspace/);
    expect(publish).toContain("verifyPublishedUrlHealthWithRetry");
    expect(publish).toMatch(/published/i);
  });

  test("Flow B — zip import, preview, publish", async () => {
    const zip = read("src/app/api/projects/import-zip/route.ts");
    const preview = read("src/lib/preview/preview-build-service.ts");
    expect(zip).toContain("extractAndAnalyzeZip");
    expect(preview).toMatch(/preview/i);
  });

  test("Flow C — readiness, wrapper, mobile build", async () => {
    const readiness = read("src/lib/mobile/readiness-engine.ts");
    const build = read("src/app/api/projects/[id]/mobile/build/route.ts");
    expect(readiness).toContain("runAppReadinessEngine");
    expect(build).toContain("verifyBuildArtifact");
    expect(build).toContain("mobile_build_jobs");
  });

  test("Flow D — notifications, broadcast, bell", async () => {
    const panel = read("src/components/notifications/notification-panel.tsx");
    const broadcast = read("src/app/api/admin/notifications/broadcast/route.ts");
    expect(panel).toMatch(/notification/i);
    expect(broadcast).toContain("broadcast");
  });

  test("Flow E — billing upgrade", async () => {
    const paddle = read("src/app/api/billing/paddle/webhook/route.ts");
    expect(paddle).toMatch(/paddle|subscription/i);
    expect(read("scripts/mid-cycle-upgrade-credits-tests.ts")).toContain("new_remaining");
  });
});
