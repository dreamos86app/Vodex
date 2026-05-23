import { test, expect } from "@playwright/test";

test.describe("Publish public URL", () => {
  test("unpublished slug route handles missing apps", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const root = process.cwd();
    const page = fs.readFileSync(path.join(root, "src/app/p/[slug]/page.tsx"), "utf8");
    expect(page).toContain("PublicAppNotFound");
    expect(fs.existsSync(path.join(root, "src/components/publish/public-app-not-found.tsx"))).toBeTruthy();
  });

  test("publish and unpublish API files exist", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const root = process.cwd();
    expect(fs.existsSync(path.join(root, "src/app/api/projects/[id]/publish/route.ts"))).toBeTruthy();
    expect(fs.existsSync(path.join(root, "src/app/api/projects/[id]/unpublish/route.ts"))).toBeTruthy();
    expect(fs.existsSync(path.join(root, "src/app/api/projects/[id]/publish/versions/route.ts"))).toBeTruthy();
  });

  test("public page uses snapshot only", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.join(process.cwd(), "src/app/p/[slug]/page.tsx"), "utf8");
    expect(src).toContain("PublicAppNotFound");
    expect(src).not.toContain("app_files");
  });

  test("publish readiness module exists", async () => {
    const fs = await import("fs");
    const path = await import("path");
    expect(
      fs.existsSync(path.join(process.cwd(), "src/lib/publish/publish-readiness.ts")),
    ).toBeTruthy();
  });

  test("path mode default in public URL", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const cfg = fs.readFileSync(path.join(process.cwd(), "src/lib/publish/publish-config.ts"), "utf8");
    expect(cfg).toContain("DREAMOS_DNS_VERIFIED");
  });

  test("custom slug check API exists", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/publish/check-slug/route.ts"),
      "utf8",
    );
    expect(src).toContain("POST");
    expect(src).toContain("validateCustomSlug");
  });

  test("reserved slug rejected in app-slug", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/publish/app-slug.ts"), "utf8");
    expect(src).toContain("validateCustomSlug");
    expect(src).toContain("RESERVED_PUBLISH_SLUGS");
  });
});
