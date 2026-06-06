#!/usr/bin/env node
/**
 * Public /p/[slug] rendering verification — structural + fixture proof.
 * Live slug test optional via PUBLISHED_TEST_SLUG + E2E_BASE_URL.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CHECKS } from "./lib/p42-verify-checks.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "artifacts", "benchmarks", "p13");

async function main() {
  const errors = [];

  function run(cmd, args) {
    return spawnSync(cmd, args, { cwd: root, shell: true, encoding: "utf8" });
  }

  for (const err of CHECKS["published-app-runtime"](root)) errors.push(err);
  for (const err of CHECKS["published-spa-routing"](root)) errors.push(err);

  const route = fs.readFileSync(
    path.join(root, "src/app/p/[slug]/[[...path]]/route.ts"),
    "utf8",
  );
  if (!route.includes("resolvePublishedAppHtml")) {
    errors.push("public route must call resolvePublishedAppHtml");
  }
  if (route.includes("coming soon") || route.includes("Coming soon")) {
    errors.push("public route must not hardcode coming soon stub");
  }

  const assets = fs.readFileSync(
    path.join(root, "src/app/api/public/[slug]/assets/[...path]/route.ts"),
    "utf8",
  );
  if (!assets.includes("resolvePublishedArtifactPath")) {
    errors.push("public assets route must resolve artifact path with metadata fallback");
  }

  const fixtureRun = run("npx", ["tsx", "scripts/test-public-rendering.ts"]);
  if (fixtureRun.status !== 0) {
    errors.push(`fixture tests failed: ${(fixtureRun.stderr || fixtureRun.stdout).trim()}`);
  }

  const baseUrl = (
    process.env.E2E_BASE_URL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const testSlug = process.env.PUBLISHED_TEST_SLUG?.trim().toLowerCase() ?? null;

  const live = {
    attempted: false,
    pass: false,
    skipped: true,
    reason: "Set PUBLISHED_TEST_SLUG (+ running server at E2E_BASE_URL) for live /p/[slug] proof",
    slug: testSlug,
    routes_tested: [],
  };

  if (testSlug) {
    live.attempted = true;
    live.skipped = false;
    const routes = [`/p/${testSlug}`, `/p/${testSlug}/`];
    const tested = [];
    let liveOk = true;
    async function fetchPublishedRoute(routePath) {
      let url = `${baseUrl}${routePath}`;
      for (let hop = 0; hop < 5; hop++) {
        const res = await fetch(url, { redirect: "manual" });
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get("location");
          if (!loc) return { res, html: await res.text(), finalUrl: url };
          url = loc.startsWith("http") ? loc : new URL(loc, url).href;
          continue;
        }
        const html = await res.text();
        return { res, html, finalUrl: url };
      }
      throw new Error(`Too many redirects for ${routePath}`);
    }

    for (const routePath of routes) {
      try {
        const { res, html, finalUrl } = await fetchPublishedRoute(routePath);
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        const title = titleMatch?.[1]?.trim() ?? "";
        tested.push({
          route: routePath,
          status: res.status,
          finalUrl,
          bytes: html.length,
          title,
        });
        const okStatus = res.status === 200 || (routePath.endsWith("/") && res.status === 308);
        if (!okStatus && res.status !== 200) liveOk = false;
        if (res.status === 200 && html.length < 80) liveOk = false;
        if (res.status === 200 && !title) liveOk = false;
        if (/coming soon/i.test(html) && !/Recipe|main|app|root/i.test(html)) liveOk = false;
        if (res.status === 503 && /republish needed/i.test(html)) {
          tested[tested.length - 1].staleArtifact = true;
        }
      } catch (e) {
        liveOk = false;
        tested.push({ route: routePath, error: String(e) });
      }
    }
    live.pass = liveOk;
    live.routes_tested = tested;
    if (!liveOk) errors.push("live /p/[slug] fetch failed or returned stub/empty body");
  }

  const pass = errors.length === 0;
  const artifact = {
    generatedAt: new Date().toISOString(),
    pass,
    mode: live.pass ? "live" : pass ? "structural_fixture" : "failed",
    structuralChecks: errors.length === 0 || fixtureRun.status === 0,
    fixtureTests: fixtureRun.status === 0,
    live,
    errors,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "public-rendering.json"), JSON.stringify(artifact, null, 2));
  fs.writeFileSync(path.join(outDir, "publish-rendering.json"), JSON.stringify(artifact, null, 2));
  if (live.attempted && !live.skipped) {
    const liveArtifact = {
      executed: true,
      status: "EXECUTED",
      pass: live.pass,
      timestamp: artifact.generatedAt,
      environment: {
        baseUrl: process.env.E2E_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
        slug: live.slug ?? null,
      },
      routes_tested: live.routes_tested ?? [],
      failureReason: live.pass ? null : errors.join("; ") || "live /p/[slug] check failed",
    };
    fs.writeFileSync(path.join(outDir, "live-public-rendering.json"), JSON.stringify(liveArtifact, null, 2));
  }

  console.log("\n=== verify:public-rendering ===\n");
  console.log(`Structural + fixture: ${fixtureRun.status === 0 ? "pass" : "fail"}`);
  console.log(`Live slug: ${live.skipped ? "skipped" : live.pass ? "pass" : "fail"}`);
  if (errors.length) {
    console.error("\n✗ verify:public-rendering failed\n");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`\n✓ verify:public-rendering passed (${artifact.mode})`);
  console.log(`✓ Wrote ${path.join(outDir, "public-rendering.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
