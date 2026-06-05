#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { P53_UNIT_ECONOMICS } from "./lib/p53-verify-checks.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = P53_UNIT_ECONOMICS(root);
if (errors.length) {
  console.error("✗ verify:p53-unit-economics", errors[0]);
  process.exit(1);
}
console.log("✓ verify:p53-unit-economics");
