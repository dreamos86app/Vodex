#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { P54_CREDIT_ECONOMY } from "./lib/p54-verify-checks.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = P54_CREDIT_ECONOMY(root);
if (errors.length) {
  console.error("P5.4 credit economy FAILED:");
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("✓ P5.4 credit economy");
