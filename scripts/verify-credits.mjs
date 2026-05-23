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

mustInclude(
  "src/lib/credits/charge-ai-operation.ts",
  "writeCreditEvent",
  "uses safe credit event writer",
);
mustInclude("src/lib/credits/credit-events.ts", "credits_consumed: credits", "credit-events helper");
mustInclude("src/lib/credits/credit-events.ts", 'event_type: input.eventType ??', "credit_events event_type");
mustInclude("src/lib/billing/credit-profit-guard.ts", "quoteDiscussCost", "discuss microcharge pricing");

const bad = /credit_events[\s\S]{0,400}amount:\s*-input\.amount/;
const chargeSrc = fs.readFileSync(path.join(root, "src/lib/credits/charge-ai-operation.ts"), "utf8");
if (bad.test(chargeSrc)) errors.push("charge-ai-operation still uses legacy amount field on credit_events");
else ok.push("no legacy amount field on credit_events");

console.log("\n=== verify:credits ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
