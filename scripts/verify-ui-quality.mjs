#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "src/lib/generation/ui-quality-spec.ts",
  "src/lib/generation/ui-pattern-library.ts",
  "src/lib/generation/design-token-presets.ts",
  "src/lib/generation/generated-ui-review.ts",
  "src/lib/generation/ui-polish-pass.ts",
  "src/lib/generation/app-type-ui-requirements.ts",
  "src/lib/build/complete-build-with-validation.ts",
  "src/lib/build/format-blueprint-prompt.ts",
];

const errors = [];
const ok = [];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(rel);
}

const complete = fs.readFileSync(path.join(root, "src/lib/build/complete-build-with-validation.ts"), "utf8");
if (complete.includes("reviewGeneratedUi") && complete.includes("uiQualityBlocksGenerated")) {
  ok.push("build completion runs UI review gate");
} else {
  errors.push("complete-build-with-validation missing UI review gate");
}

const fmt = fs.readFileSync(path.join(root, "src/lib/build/format-blueprint-prompt.ts"), "utf8");
if (fmt.includes("buildFullUiGenerationBlock") && fmt.includes("stylePresetId")) {
  ok.push("blueprint prompt includes UI quality + style preset");
} else {
  errors.push("format-blueprint-prompt missing UI quality / style preset");
}

const review = fs.readFileSync(path.join(root, "src/lib/generation/generated-ui-review.ts"), "utf8");
if (review.includes("passesGate") && review.includes("placeholderRisk") && review.includes("scoreAppTypeCompliance")) {
  ok.push("generated-ui-review scores app-type + placeholder risk");
} else {
  errors.push("generated-ui-review missing app-type / placeholder scoring");
}

const spec = fs.readFileSync(path.join(root, "src/lib/generation/ui-quality-spec.ts"), "utf8");
if (spec.includes("minOverall: 82") && spec.includes("buildSuccessRate: 0.9") && spec.includes("averageUiScore: 88")) {
  ok.push("UI quality thresholds 82+ with live benchmark targets (90%/5%/88)");
} else {
  errors.push("ui-quality-spec missing updated thresholds or benchmark targets");
}

const complete2 = fs.readFileSync(path.join(root, "src/lib/build/complete-build-with-validation.ts"), "utf8");
if (complete2.includes("planUiPolishPass") && complete2.includes("ui_polish_quoted_credits")) {
  ok.push("build completion wires polish quote metadata");
} else {
  errors.push("complete-build missing polish quote wiring");
}

const r = spawnSync("npx", ["tsx", path.join(root, "scripts/ui-quality-tests.ts")], {
  cwd: root,
  shell: true,
  encoding: "utf8",
});
if (r.status === 0) {
  ok.push("fixture tests: placeholder fails, CRM passes, style presets differ");
} else {
  errors.push(`fixture tests failed: ${(r.stderr || r.stdout || "").trim()}`);
}

console.log("\n=== verify:ui-quality ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
