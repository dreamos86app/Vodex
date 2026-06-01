/**
 * Public routes must not import builder/admin-heavy modules.
 * Run: npm run verify:performance-budget
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const PUBLIC_ROUTE_FILES = [
  "src/app/(app)/page.tsx",
  "src/app/auth/login/page.tsx",
  "src/app/onboarding/page.tsx",
  "src/app/pricing/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/privacy/page.tsx",
  "src/app/refunds/page.tsx",
  "src/components/marketing/public-landing.tsx",
  "src/components/auth/login-view.tsx",
];

const FORBIDDEN_IMPORTS = [
  /creation-workspace/,
  /immersive-workspace/,
  /generation-workspace/,
  /admin-view/,
  /platform-shell/,
  /diagnostics-bootstrap/,
  /command-center/,
];

const ALLOW_DYNAMIC = /dynamic\s*\(/;

async function read(rel) {
  const p = path.join(ROOT, rel);
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

async function main() {
  const errors = [];

  for (const rel of PUBLIC_ROUTE_FILES) {
    const text = await read(rel);
    if (!text) continue;
    for (const re of FORBIDDEN_IMPORTS) {
      if (re.test(text) && !ALLOW_DYNAMIC.test(text)) {
        errors.push(`${rel}: forbidden import pattern ${re}`);
      }
    }
  }

  const landing = await read("src/components/marketing/public-landing.tsx");
  if (landing && !landing.includes("dynamic(")) {
    errors.push("public-landing.tsx: expected dynamic() for below-fold sections");
  }

  const lightweight = await read("src/lib/routing/lightweight-public-paths.ts");
  if (!lightweight?.includes('"/pricing"')) {
    errors.push("lightweight-public-paths.ts: missing /pricing");
  }

  const provider = await read("src/components/providers/app-provider.tsx");
  if (!provider?.includes("isLightweightPublicPath")) {
    errors.push("app-provider.tsx: missing lightweight public path guard");
  }

  const dreamosAssets = await fs.readdir(path.join(ROOT, "public/brand")).catch(() => []);
  const usedDreamosPng = [];
  for (const name of dreamosAssets) {
    if (!/dreamos86/i.test(name)) continue;
    const srcScan = await fs.readFile(path.join(ROOT, "src"), "utf8").catch(() => "");
    if (srcScan.includes(name)) usedDreamosPng.push(name);
  }

  if (errors.length) {
    console.error("verify:performance-budget FAILED\n");
    errors.forEach((e) => console.error("  -", e));
    process.exit(1);
  }

  console.log("verify:performance-budget OK");
  if (usedDreamosPng.length === 0 && dreamosAssets.some((n) => /dreamos86/i.test(n))) {
    console.log("  (info) legacy public/brand/dreamos86-* assets exist but are not imported from src/)");
  }
}

main();
