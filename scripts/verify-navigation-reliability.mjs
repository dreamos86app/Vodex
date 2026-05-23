#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustInclude(rel, needle, label) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (!src.includes(needle)) errors.push(`${rel} missing ${label}`);
  else ok.push(`${rel}: ${label}`);
}

mustInclude("src/components/layout/navigation-progress.tsx", "markNavigationStart", "nav start");
mustInclude("src/components/layout/navigation-progress.tsx", "markNavigationComplete", "nav complete");
mustInclude("src/components/layout/sidebar.tsx", "router.prefetch", "sidebar prefetch");
mustInclude("src/components/layout/platform-shell.tsx", "popLayout", "non-blocking route transitions");

console.log("\n=== verify:navigation-reliability ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
