import { test, expect } from "./helpers/live-gate";
import { assertE2eAuthInBrowserContext } from "./helpers/e2e-auth-probe";

test.describe("E2E auth probe — @live", () => {
  test("@live browser context auth is resolved", async ({ page, request, liveGate }) => {
    test.setTimeout(120_000);
    if (!liveGate) return;
    const result = await assertE2eAuthInBrowserContext({ page, request });
    expect(result.userId).toMatch(/^[a-f0-9-]{36}$/i);
    expect(result.creditsStatus).toBe(200);
    expect(result.onboardingCompleted).toBe(true);
  });
});
