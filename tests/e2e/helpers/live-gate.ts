import fs from "node:fs";
import path from "node:path";
import { test as baseTest } from "@playwright/test";

export const AUTH_FILE = path.join(process.cwd(), ".playwright-auth.json");
export const IS_LIVE = process.env.E2E_RUN_LIVE === "1";

export function authFileExists(): boolean {
  try {
    return fs.existsSync(AUTH_FILE) && fs.statSync(AUTH_FILE).size > 10;
  } catch {
    return false;
  }
}

type LiveFixtures = {
  liveGate: boolean;
};

export const test = baseTest.extend<LiveFixtures>({
  // eslint-disable-next-line no-empty-pattern
  liveGate: async ({}, use, testInfo) => {
    if (!IS_LIVE) {
      testInfo.skip(true, "Set E2E_RUN_LIVE=1 for live journeys");
      await use(false);
      return;
    }
    if (!authFileExists()) {
      testInfo.skip(true, "Missing .playwright-auth.json — run verify:e2e-auth");
      await use(false);
      return;
    }
    await use(true);
  },
});

export { expect } from "@playwright/test";
