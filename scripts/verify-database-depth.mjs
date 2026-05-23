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

mustExist("src/lib/build/database-depth-plan.ts");

const src = fs.readFileSync(path.join(root, "src/lib/build/database-depth-plan.ts"), "utf8");
if (src.includes("rlsPolicies") && src.includes("migrationHonesty")) ok.push("RLS + migration honesty");
else errors.push("database depth missing RLS or honesty");

const r = spawnSync("npx", ["tsx", path.join(root, "scripts/verify-database-depth.ts")], {
  cwd: root,
  shell: true,
  encoding: "utf8",
});
if (r.status === 0) ok.push("database depth runtime tests");
else {
  errors.push("database depth tests failed");
  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.error(r.stderr);
}

console.log("\n=== verify:database-depth ===\n");
ok.forEach((m) => console.log("✓", m));
if (errors.length) {
  errors.forEach((m) => console.error("✗", m));
  process.exit(1);
}
console.log(`\n${ok.length} checks passed.\n`);
