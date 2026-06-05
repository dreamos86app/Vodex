#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function must(rel, needle, label) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (!src.includes(needle)) errors.push(`${rel} missing ${label}`);
  else ok.push(label);
}

must("src/lib/credits/canonical-credits.ts", "loadCanonicalCredits", "canonical loader");
must("src/lib/credits/canonical-credits.ts", "computeActiveBonus", "explicit bonus only");
must("src/lib/credits/normalize-credit-balance.ts", "normalizeAvailableCredits", "inflate clamp");
must("src/lib/credits/normalize-credit-balance.ts", "repairProfileCreditsIfInflated", "auto repair");
must("src/lib/credits/format-credit-reset.ts", "formatCreditResetLocal", "local reset label");
must("src/lib/billing/plan-credit-economics.ts", "free: 20", "free plan 20 build allowance");
must("src/lib/billing/plan-credit-economics.ts", "free: 20", "free plan 20 action allowance");
must("src/lib/admin/list-users.ts", "buildCanonicalBucket", "admin canonical");

console.log("\n=== verify:credit-truth ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
