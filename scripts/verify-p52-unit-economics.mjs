#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { P52_UNIT_ECONOMICS } from "./lib/p52-verify-checks.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = P52_UNIT_ECONOMICS(root);
if (errors.length) {
  console.error("✗ verify:p52-unit-economics", errors[0]);
  process.exit(1);
}
const r = spawnSync("node", ["scripts/audit-unit-economics.mjs"], { cwd: root, encoding: "utf8" });
process.stdout.write(r.stdout ?? "");
if (r.status !== 0) {
  process.stderr.write(r.stderr ?? "");
  process.exit(1);
}
console.log("✓ verify:p52-unit-economics");
