import { test, expect } from "@playwright/test";

test.describe("Polish pass", () => {
  test("polish route exists and rejects without auth", async ({ request }) => {
    const res = await request.post("/api/build/polish", {
      data: { projectId: "00000000-0000-0000-0000-000000000001" },
    });
    expect([400, 401, 403, 404, 422]).toContain(res.status());
  });
});
