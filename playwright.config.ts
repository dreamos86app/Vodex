import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const authPath = process.env.PLAYWRIGHT_STORAGE ?? ".playwright-auth.json";
const hasAuth = fs.existsSync(authPath);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "tests/e2e/report.json" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    ...(hasAuth ? { storageState: authPath } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
