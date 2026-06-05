#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { P54_ACTION_COST_AUDIT } from "./lib/p54-verify-checks.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = P54_ACTION_COST_AUDIT(root);
if (errors.length) {
  console.error("P5.4 action cost audit FAILED:");
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("✓ P5.4 action cost audit");
