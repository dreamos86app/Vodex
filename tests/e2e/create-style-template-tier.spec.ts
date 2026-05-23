import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("Style template tier wiring (structure)", () => {
  test("blueprint route accepts stylePresetId", async () => {
    const p = path.join(process.cwd(), "src/app/api/build/blueprint/route.ts");
    const t = fs.readFileSync(p, "utf8");
    expect(t).toContain("stylePresetId");
  });

  test("create-from-prompt accepts template and style", async () => {
    const p = path.join(process.cwd(), "src/app/api/projects/create-from-prompt/route.ts");
    const t = fs.readFileSync(p, "utf8");
    expect(t).toContain("stylePresetId");
    expect(t).toContain("buildTier");
  });

  test("style-presets lib exists", async () => {
    expect(fs.existsSync(path.join(process.cwd(), "src/lib/create/style-presets.ts"))).toBeTruthy();
  });
});
