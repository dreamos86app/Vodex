#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pricing = fs.readFileSync(path.join(root, "src/components/pricing/pricing-view.tsx"), "utf8");

const checks = [
  [pricing.includes('label: "Analytics"') && pricing.includes("starter: true"), "Analytics Starter+"],
  [pricing.includes('label: "ZIP import"') && pricing.includes("pro: true"), "ZIP import Pro+"],
  [pricing.includes("Android AAB"), "Android packaging row"],
];

let failed = false;
for (const [ok, label] of checks) {
  if (!ok) {
    console.error("✗", label);
    failed = true;
  } else {
    console.log("✓", label);
  }
}
process.exit(failed ? 1 : 0);
