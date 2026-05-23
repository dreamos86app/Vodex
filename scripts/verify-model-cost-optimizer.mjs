#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const optimizerPath = path.join(root, "src/lib/ai/model-cost-optimizer.ts");
const runtimePath = path.join(root, "src/lib/ai/model-cost-runtime.ts");
const trackerPath = path.join(root, "src/lib/ai/operation-budget-tracker.ts");
const routeLogPath = path.join(root, "src/lib/ai/route-decision-log.ts");

const ok = [];
const err = [];

for (const p of [optimizerPath, runtimePath, trackerPath, routeLogPath]) {
  if (!fs.existsSync(p)) err.push(`missing ${path.relative(root, p)}`);
}

if (!err.length) {
  const s = fs.readFileSync(optimizerPath, "utf8");
  const r = fs.readFileSync(runtimePath, "utf8");
  const t = fs.readFileSync(trackerPath, "utf8");

  if (s.includes("question_only")) ok.push("question uses no build stages");
  else err.push("missing question_only short-circuit");
  if (s.includes("gpt-4o-mini")) ok.push("mini for cheap stages");
  if (s.includes("prompt_normalization")) ok.push("prompt normalization stage (mini)");
  else err.push("missing prompt_normalization stage");
  if (s.includes("backend_generation")) ok.push("backend/security stage with escalation");
  else err.push("missing backend_generation stage");
  if (s.includes("polish_diagnosis") && s.includes("polish_patch")) ok.push("polish diagnosis + patch stages");
  else err.push("missing polish stages");
  if (s.includes("recommendCheaperMode")) ok.push("cheaper mode recommendation");
  else err.push("missing cheaper recommendation");
  if (s.includes("silentDowngrade: false")) ok.push("no silent downgrade flag");
  else err.push("missing silentDowngrade guard");
  if (s.includes("security_backend_required")) ok.push("backend security escalation reason");
  else err.push("missing security escalation");
  if (s.includes("repeated_validation_failure")) ok.push("validation failure escalation");
  else err.push("missing validation escalation");

  if (r.includes("OperationBudgetTracker")) ok.push("runtime wires budget tracker");
  else err.push("runtime missing budget tracker");
  if (r.includes("logRouteDecision")) ok.push("runtime logs admin route decisions");
  else err.push("runtime missing route decision logging");

  if (t.includes("providerCapUsd") && t.includes("cacheHit")) ok.push("tracker records cap + cache");
  else err.push("tracker missing cap/cache tracking");
  if (t.includes("grossMargin")) ok.push("tracker records gross margin");
  else err.push("tracker missing margin");
}

console.log("\n=== verify:model-cost-optimizer ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
err.forEach((m) => console.error(`✗ ${m}`));
process.exit(err.length ? 1 : 0);
