#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(rel);
}

[
  "src/lib/navigation/route-perf.ts",
  "src/components/layout/navigation-progress.tsx",
  "src/app/(workspace)/create/loading.tsx",
  "src/app/(app)/dashboard/loading.tsx",
  "src/app/(app)/chat/loading.tsx",
].forEach(mustExist);

const nav = fs.readFileSync(path.join(root, "src/components/layout/navigation-progress.tsx"), "utf8");
if (!nav.includes("markNavigationStart")) errors.push("navigation-progress must instrument clicks");
else ok.push("click instrumentation");

if (!nav.includes("markNavigationComplete")) errors.push("navigation-progress must complete on pathname");
else ok.push("pathname completion");

const perf = fs.readFileSync(path.join(root, "src/lib/navigation/route-perf.ts"), "utf8");
if (!perf.includes("1500")) errors.push("route-perf slow threshold");
else ok.push("slow route threshold");

console.log("\n=== verify:performance ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
