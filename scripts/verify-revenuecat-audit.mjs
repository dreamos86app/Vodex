#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p) || !fs.readFileSync(p, "utf8").includes(needle)) errors.push(label);
};

must("src/lib/mobile/revenuecat-audit.ts", "runRevenueCatAudit", "audit runner");
must("src/lib/mobile/revenuecat-audit.ts", '"blocked"', "blocked status");
must("src/lib/mobile/revenuecat-audit.ts", "hasSubscriptionSignals", "subscription signal detection");
must("src/lib/mobile/readiness-engine.ts", "runRevenueCatAudit", "engine integrates audit");
must("src/lib/mobile/readiness-gate.ts", "assertMobileReadinessGate", "gate blocks publish");

if (errors.length) {
  console.error("verify:revenuecat-audit FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:revenuecat-audit OK");
