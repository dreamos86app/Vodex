#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const spec = path.join(root, "tests/e2e/staging-production.spec.ts");
const errors = [];

if (!fs.existsSync(spec)) {
  errors.push("tests/e2e/staging-production.spec.ts missing");
} else {
  const src = fs.readFileSync(spec, "utf8");
  for (const flow of [
    "Flow A",
    "Flow B",
    "Flow C",
    "Flow D",
    "Flow E",
    "create app",
    "zip import",
    "readiness",
    "notifications",
    "billing upgrade",
  ]) {
    if (!src.toLowerCase().includes(flow.toLowerCase())) {
      errors.push(`staging spec mentions ${flow}`);
    }
  }
}

if (errors.length) {
  console.error("verify:staging-e2e FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:staging-e2e OK");
