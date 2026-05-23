#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(`exists ${rel}`);
}

mustExist("src/lib/build/backend-plan.ts");
mustExist("src/lib/build/blueprint-deterministic.ts");

const bp = fs.readFileSync(path.join(root, "src/lib/build/backend-plan.ts"), "utf8");
if (bp.includes("honestLimitations") && bp.includes("previewMockStrategy")) ok.push("honest backend preview");
else errors.push("backend plan missing honest preview strategy");
if (bp.includes("rlsExpectations")) ok.push("RLS expectations");
else errors.push("missing RLS expectations");

const r = spawnSync("npx", ["tsx", path.join(root, "scripts/verify-backend-depth.ts")], {
  cwd: root,
  shell: true,
  encoding: "utf8",
});
if (r.status === 0) ok.push("backend depth runtime tests");
else {
  errors.push("backend depth tests failed");
  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.error(r.stderr);
}

console.log("\n=== verify:backend-generation ===\n");
ok.forEach((m) => console.log("✓", m));
if (errors.length) {
  errors.forEach((m) => console.error("✗", m));
  process.exit(1);
}
console.log(`\n${ok.length} checks passed.\n`);
