#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHECKS } from "./lib/p42-verify-checks.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkId = process.argv[2];
if (!checkId || !CHECKS[checkId]) {
  console.error(`Usage: node verify-p42-check.mjs <${Object.keys(CHECKS).join("|")}>`);
  process.exit(1);
}

const errors = CHECKS[checkId](root);
if (errors.length) {
  console.error(`verify:${checkId} FAILED\n`, errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`verify:${checkId} OK`);
