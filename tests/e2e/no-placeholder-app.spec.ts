import { test, expect } from "@playwright/test";

test.describe("No placeholder app", () => {
  test("generated app validator module exists", async () => {
    const fs = await import("fs");
    const path = await import("path");
    expect(
      fs.existsSync(path.join(process.cwd(), "src/lib/build/generated-app-validator.ts")),
    ).toBeTruthy();
  });
});
