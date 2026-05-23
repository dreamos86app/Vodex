import { test, expect } from "@playwright/test";

test.describe("Blueprint approval", () => {
  test("production build shows blueprint gate files exist", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const root = process.cwd();
    expect(fs.existsSync(path.join(root, "src/lib/build/blueprint-schema.ts"))).toBeTruthy();
    expect(fs.existsSync(path.join(root, "src/app/api/build/blueprint/route.ts"))).toBeTruthy();
  });
});
