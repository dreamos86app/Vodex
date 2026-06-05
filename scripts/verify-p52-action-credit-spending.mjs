#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { P52_ACTION_CREDIT_SPENDING } from "./lib/p52-verify-checks.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = P52_ACTION_CREDIT_SPENDING(root);
if (errors.length) {
  console.error("✗ verify:p52-action-credit-spending", errors[0]);
  process.exit(1);
}
console.log("✓ verify:p52-action-credit-spending");
