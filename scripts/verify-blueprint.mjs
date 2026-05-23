#!/usr/bin/env node
/**
 * Blueprint schema + guard checks (no test runner required).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(root, "src/lib/build/blueprint-schema.ts");
const src = readFileSync(schemaPath, "utf8");

const errors = [];
const ok = [];

function assert(c, m) {
  (c ? ok : errors).push(m);
}

assert(src.includes("oneSentencePitch"), "schema has oneSentencePitch");
assert(src.includes("requiresBlueprintApproval"), "approval helper exists");
assert(src.includes("rejectBannedRefs") || src.includes("xycqut"), "banned ref guard");
assert(src.includes("SECRET_PATTERN"), "secrets rejected");
assert(src.includes("MODEL_LEAK"), "model names rejected for users");

const pricing = readFileSync(join(root, "src/lib/billing/pricing-config.ts"), "utf8");
assert(pricing.includes("USER_CREDITS_PER_USD = 10"), "10 user credits per USD");

const oldCopy = [];
for (const rel of ["src/components/pricing/pricing-view.tsx", "src/components/marketing/public-landing.tsx"]) {
  const t = readFileSync(join(root, rel), "utf8");
  if (/50\s*credits\s*=\s*\$1|1\s*USD\s*=\s*50\s*credit/i.test(t)) oldCopy.push(rel);
}
assert(oldCopy.length === 0, `no public 50 credits=$1 copy (${oldCopy.join(", ")})`);

mustExist("src/lib/build/blueprint-archetypes.ts");
mustExist("src/lib/build/blueprint-scoring.ts");
mustExist("src/lib/build/blueprint-deterministic.ts");

function mustExist(rel) {
  if (!existsSync(join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(`exists ${rel}`);
}

const depth = spawnSync("npx", ["tsx", join(root, "scripts/verify-blueprint-depth.ts")], {
  cwd: root,
  shell: true,
  encoding: "utf8",
});
if (depth.status === 0) ok.push("blueprint depth runtime tests");
else {
  errors.push("blueprint depth tests failed");
  if (depth.stdout) console.log(depth.stdout);
  if (depth.stderr) console.error(depth.stderr);
}

console.log("\n=== verify:blueprint (inline) ===\n");
ok.forEach((m) => console.log("✓", m));
if (errors.length) {
  errors.forEach((m) => console.error("✗", m));
  process.exit(1);
}
console.log(`\n${ok.length} checks passed.\n`);
