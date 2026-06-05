#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const suites = [
  { script: "verify:p40-mobile-db", weight: 15, category: "Database" },
  { script: "verify:android-builder", weight: 20, category: "Android Builder" },
  { script: "verify:p39-production", weight: 25, category: "Regression" },
  { script: "verify:mobile-build-pipeline", weight: 10, category: "Mobile" },
  { script: "verify:publish-health", weight: 5, category: "Publish" },
];

let score = 0;
let max = 0;
const blockers = [];

for (const s of suites) {
  max += s.weight;
  const r = spawnSync("npm", ["run", s.script], { cwd: root, shell: true, encoding: "utf8" });
  if (r.status === 0) {
    score += s.weight;
    console.log(`✓ ${s.script}`);
  } else {
    blockers.push(s);
    console.error(`✗ ${s.script} FAILED`);
  }
}

const pct = max ? Math.round((score / max) * 100) : 0;
console.log(`\nP4.0 infrastructure score (scripts): ${pct}/100`);
if (blockers.length) {
  console.log("Blockers:", blockers.map((b) => b.script).join(", "));
}
process.exit(blockers.length ? 1 : 0);
