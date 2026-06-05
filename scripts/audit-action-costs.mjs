#!/usr/bin/env node
/**
 * P5.4 — Full action cost audit table.
 * Run: npm run audit:action-costs
 */
import { auditAllActions, ACTION_CATALOG } from "./lib/action-cost-audit.mjs";

const rows = auditAllActions();
const failed = rows.filter((r) => !r.pass && r.totalCost > 0);

console.log("=== Vodex Action Cost Audit (P5.4.4) ===\n");
console.log(
  "id".padEnd(28) +
    "provider".padEnd(22) +
    "cost".padStart(8) +
    "credits".padStart(8) +
    "revenue".padStart(9) +
    "margin%".padStart(9) +
    "mult".padStart(7) +
    "pass".padStart(6),
);
console.log("-".repeat(97));

for (const r of rows) {
  console.log(
    r.id.padEnd(28) +
      (r.provider ?? "").padEnd(22) +
      `$${r.totalCost.toFixed(4)}`.padStart(8) +
      String(r.creditCost).padStart(8) +
      `$${r.revenue.toFixed(4)}`.padStart(9) +
      `${r.marginPct.toFixed(1)}%`.padStart(9) +
      `${r.mult.toFixed(1)}x`.padStart(7) +
      (r.pass ? "  ✓" : "  ✗").padStart(6),
  );
}

console.log(`\nTotal actions: ${ACTION_CATALOG.length}`);
console.log(`Pass 5x+: ${rows.length - failed.length}/${rows.length}`);
if (failed.length) {
  console.log("\nFAILURES:");
  for (const f of failed) {
    console.log(`  ${f.id}: ${f.mult.toFixed(2)}x (need 5x+)`);
  }
  process.exit(1);
}
