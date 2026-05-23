#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(rel);
}

function mustInclude(file, needle, label) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (text.includes(needle)) ok.push(label);
  else errors.push(`${label} — missing in ${file}`);
}

[
  "src/components/repair/repair-center.tsx",
  "src/lib/repair/repair-classifier.ts",
  "src/lib/repair/repair-actions.ts",
  "src/lib/repair/repair-context.ts",
  "src/lib/repair/run-user-ai-repair.ts",
  "src/lib/repair/save-checkpoint.ts",
  "src/app/api/projects/[id]/repair/route.ts",
  "scripts/dreamos-runtime-repair.sql",
  "tests/e2e/failure-repair.spec.ts",
].forEach(mustExist);

mustInclude("src/lib/repair/repair-classifier.ts", "migration_missing", "repair type migration_missing");
mustInclude("src/lib/repair/repair-classifier.ts", "insufficient_credits", "repair type insufficient_credits");
mustInclude("src/lib/repair/repair-classifier.ts", "vercel_not_connected", "repair type vercel_not_connected");
mustInclude("src/lib/repair/repair-classifier.ts", "preview_failed", "repair type preview_failed");
mustInclude("src/lib/repair/repair-classifier.ts", "validation_failed", "repair type validation_failed");
mustInclude("src/lib/repair/repair-classifier.ts", "no_files", "repair type no_files");
mustInclude("src/lib/repair/repair-classifier.ts", "provider_cap_hit", "repair type provider_cap_hit");
mustInclude("src/lib/repair/repair-classifier.ts", "whatHappened", "issue whatHappened field");
mustInclude("src/lib/repair/repair-classifier.ts", "exactFix", "issue exactFix field");

mustInclude("src/lib/repair/run-user-ai-repair.ts", "reserveCreditsForGeneration", "AI repair reserves credits");
mustInclude("src/lib/repair/run-user-ai-repair.ts", "saveProjectCheckpoint", "AI repair checkpoint before apply");
mustInclude("src/lib/repair/run-user-ai-repair.ts", "reconcileGenerationReservation", "AI repair refund on failure");

mustInclude("src/app/api/projects/[id]/repair/route.ts", "export async function POST", "repair POST endpoint");
mustInclude("src/app/api/projects/[id]/repair/route.ts", "run_ai_repair", "run_ai_repair action");
mustInclude("src/app/api/projects/[id]/repair/route.ts", "show_sql", "show_sql action");

mustInclude("src/components/repair/repair-center.tsx", "Copy technical details", "copy technical details UI");
mustInclude("src/components/repair/repair-center.tsx", "run_ai_repair", "repair center runs AI repair");
mustInclude("src/components/repair/repair-center.tsx", "Checking for issues", "no infinite loader — loading label");

mustInclude("src/lib/billing/pricing-config.ts", '"repair"', "repair generation mode");

const wired = [
  ["src/components/create/premium-create-funnel.tsx", "RepairCenter"],
  ["src/components/preview/preview-status-panel.tsx", "RepairCenter"],
  ["src/components/builder/app-builder-workspace.tsx", "RepairCenter"],
  ["src/components/publish/publish-status-panel.tsx", "RepairCenter"],
  ["src/components/create/workspace/app-dashboard-panel.tsx", "RepairCenter"],
];
for (const [file, needle] of wired) {
  mustInclude(file, needle, `RepairCenter wired in ${path.basename(file)}`);
}

console.log("\n=== verify:repair ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
