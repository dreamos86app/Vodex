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

function mustNotInclude(rel, needle, label) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (src.includes(needle)) errors.push(`${rel} still has ${label}`);
  else ok.push(`${rel}: no ${label}`);
}

mustInclude("src/lib/credits/credit-summary.ts", "formatCreditAmount", "credit formatter");
mustInclude("src/lib/credits/credit-summary.ts", "available", "available balance field");
mustInclude("src/components/layout/sidebar.tsx", "formatCreditAmount", "sidebar uses formatter");
mustInclude("src/components/layout/sidebar.tsx", "Plan allowance", "plan allowance label");
mustNotInclude("src/lib/supabase/load-profile-billing.ts", "capFreePlanBalance", "free plan cap removed");
mustNotInclude("src/components/providers/app-provider.tsx", "Math.min(creditsValue", "profile credit cap removed");

console.log("\n=== verify:credit-display ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
