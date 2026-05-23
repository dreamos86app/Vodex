#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pricing = fs.readFileSync(path.join(root, "src/lib/pricing.ts"), "utf8");
const analyticsView = fs.readFileSync(path.join(root, "src/components/analytics/analytics-view.tsx"), "utf8");
const analyticsApi = fs.readFileSync(path.join(root, "src/app/api/analytics/route.ts"), "utf8");

const checks = [
  [pricing.includes("planIncludesAnalytics"), "planIncludesAnalytics helper"],
  [analyticsApi.includes("planIncludesAnalytics"), "API gates free plan"],
  [analyticsView.includes("Starter and above"), "Free upgrade message"],
  [analyticsView.includes("No visits yet"), "Empty traffic state"],
];

let failed = false;
for (const [ok, label] of checks) {
  if (!ok) {
    console.error("✗", label);
    failed = true;
  } else console.log("✓", label);
}
process.exit(failed ? 1 : 0);
