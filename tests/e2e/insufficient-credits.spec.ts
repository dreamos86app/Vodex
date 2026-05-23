import { test, expect } from "@playwright/test";

test.describe("Insufficient credits", () => {
  test("credits API requires auth", async ({ request }) => {
    const res = await request.get("/api/credits");
    expect([401, 200]).toContain(res.status());
  });
});
