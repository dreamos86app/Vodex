#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { P544_MARGIN_OPTIMIZATION } from "./lib/p544-verify-checks.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = P544_MARGIN_OPTIMIZATION(root);
if (errors.length) {
  console.error("P5.4.4 margin optimization FAILED:");
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("✓ P5.4.4 margin optimization");
