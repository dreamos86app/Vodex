#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

const rateFile = path.join(root, "src/lib/security/rate-limit.ts");
if (!fs.existsSync(rateFile)) {
  errors.push("missing src/lib/security/rate-limit.ts");
} else {
  const t = fs.readFileSync(rateFile, "utf8");
  if (t.includes("checkRateLimit") && t.includes("EXPENSIVE_ROUTE_LIMITS")) {
    ok.push("rate-limit.ts with EXPENSIVE_ROUTE_LIMITS");
  } else errors.push("rate-limit.ts incomplete");
}

if (fs.existsSync(path.join(root, "src/middleware.ts"))) {
  errors.push("src/middleware.ts must not exist — use middleware.ts at root or proxy.ts");
} else ok.push("no src/middleware.ts");

const routeGuard = path.join(root, "src/lib/security/route-guard.ts");
if (!fs.existsSync(routeGuard)) errors.push("missing route-guard.ts");
else ok.push("route-guard.ts exists");

const EXPENSIVE_ROUTES = [
  "src/app/api/chat/route.ts",
  "src/app/api/build/blueprint/route.ts",
  "src/app/api/build/polish/route.ts",
  "src/app/api/projects/create-from-prompt/route.ts",
  "src/app/api/projects/[id]/publish/route.ts",
  "src/app/api/projects/[id]/unpublish/route.ts",
  "src/app/api/projects/[id]/preview/start/route.ts",
  "src/app/api/projects/[id]/repair/route.ts",
  "src/app/api/deploy/vercel/start/route.ts",
  "src/app/api/credits/quote/route.ts",
];

for (const rel of EXPENSIVE_ROUTES) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    errors.push(`missing ${rel}`);
    continue;
  }
  const text = fs.readFileSync(full, "utf8");
  if (text.includes("guardExpensiveRoute")) ok.push(`${rel} rate-limited via guardExpensiveRoute`);
  else errors.push(`${rel} missing guardExpensiveRoute (rate limit)`);
}

const authRoutes = [
  "src/app/api/auth/delete-account/route.ts",
  "src/app/api/auth/account-status/route.ts",
];
for (const rel of authRoutes) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");
  if (text.includes("requireAuthUser") || text.includes("auth.getUser()")) ok.push(`${rel} auth-gated`);
}

console.log("\n=== verify:rate-limits ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
