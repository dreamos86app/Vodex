#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const bp = spawnSync("node scripts/verify-blueprint.mjs", { cwd: root, stdio: "inherit", shell: true });
if (bp.status !== 0) process.exit(bp.status ?? 1);

const errors = [];
const ok = [];

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(`exists ${rel}`);
}

mustExist("src/lib/billing/pricing-config.ts");
mustExist("src/lib/build/blueprint-schema.ts");
mustExist("src/lib/build/app-blueprint.ts");
mustExist("src/app/api/build/blueprint/route.ts");
mustExist("src/lib/ai/generation-cache.ts");
mustExist("src/lib/ai/prompt-compressor.ts");
mustExist("src/lib/ai/file-fingerprint.ts");
mustExist("src/lib/build/premium-stage-labels.ts");
mustExist("src/lib/ai/generation-budget-planner.ts");
mustExist("src/components/builder/app-builder-workspace.tsx");
mustExist("src/lib/build/format-blueprint-prompt.ts");
mustExist("src/lib/build/blueprint-archetypes.ts");
mustExist("src/lib/build/backend-plan.ts");
mustExist("src/lib/build/database-depth-plan.ts");
mustExist("src/lib/templates/template-archetypes.ts");
mustExist("src/lib/ai/route-decision-log.ts");

const billing = fs.readFileSync(path.join(root, "src/lib/credits/charge-ai-operation.ts"), "utf8");
if (billing.includes("assertProfitableCharge")) ok.push("charge uses assertProfitableCharge");
else errors.push("charge missing profit guard");

const budget = fs.readFileSync(path.join(root, "src/lib/ai/cost-budget.ts"), "utf8");
if (budget.includes("GLOBAL_MAX_VISIBLE_OUTPUT_TOKENS = 900")) ok.push("visible output cap 900");
else errors.push("missing visible output cap");

const fp = fs.readFileSync(path.join(root, "src/lib/ai/file-fingerprint.ts"), "utf8");
if (fp.includes("xycqut")) ok.push("banned ref detector for xycqut");
else errors.push("missing xycqut ban in file-fingerprint");

const chat = fs.readFileSync(path.join(root, "src/app/api/chat/route.ts"), "utf8");
if (!chat.includes("30000") && !chat.includes("30_000")) ok.push("no 30k default in chat route");
else errors.push("30k path may still exist in chat");

console.log("\n=== verify:generation ===\n");
ok.forEach((m) => console.log("✓", m));
if (errors.length) {
  errors.forEach((m) => console.error("✗", m));
  process.exit(1);
}
console.log(`\n${ok.length} checks passed.\n`);
