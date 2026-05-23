#!/usr/bin/env node
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

mustExist("src/lib/projects/project-lifecycle.ts");
mustExist("src/lib/projects/reconcile-lifecycle.ts");

const lc = fs.readFileSync(path.join(root, "src/lib/projects/project-lifecycle.ts"), "utf8");
for (const s of ["draft", "intent_review", "blueprint_ready", "building", "generated", "preview_ready", "published", "failed"]) {
  if (lc.includes(`"${s}"`)) ok.push(`status ${s}`);
  else errors.push(`missing status ${s}`);
}
if (lc.includes("normalizeProjectStatus")) ok.push("normalizeProjectStatus");
else errors.push("missing normalizeProjectStatus");

console.log("\n=== verify:project-lifecycle ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
