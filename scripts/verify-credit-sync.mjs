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

mustInclude("src/app/api/credits/route.ts", "loadCreditSummary", "canonical credit summary");
mustInclude("src/lib/credits/credit-summary.ts", "available", "available balance");
mustInclude("src/lib/stores/credits-store.ts", "planAllowance", "store plan allowance");
mustInclude("src/lib/billing/credit-profit-guard.ts", "quoteDiscussCost", "discuss pricing");

console.log("\n=== verify:credit-sync ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
