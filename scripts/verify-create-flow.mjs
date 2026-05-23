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

function mustNotExist(rel, label) {
  if (fs.existsSync(path.join(root, rel))) errors.push(`dead file still present: ${rel} (${label})`);
  else ok.push(`${label} removed`);
}

function mustInclude(file, needle, label) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (text.includes(needle)) ok.push(label);
  else errors.push(`${label} — missing "${needle}" in ${file}`);
}

function mustNotInclude(file, needle, label) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (!text.includes(needle)) ok.push(label);
  else errors.push(`${label} — forbidden "${needle}" in ${file}`);
}

[
  "src/app/api/projects/create-from-prompt/route.ts",
  "src/app/api/projects/route.ts",
  "src/app/api/projects/classify-intent/route.ts",
  "src/app/api/projects/[id]/create-config/route.ts",
  "src/lib/projects/create-project-from-prompt.ts",
  "src/lib/create/create-flow-state.ts",
  "src/lib/create/create-flow-config.ts",
  "src/lib/create/style-presets.ts",
  "src/hooks/use-create-flow.ts",
  "src/components/create/premium-create-funnel.tsx",
  "src/components/create/create-template-picker.tsx",
  "src/components/create/create-style-presets.tsx",
  "src/components/create/create-build-confirm-step.tsx",
  "src/components/create/create-flow-summary.tsx",
  "src/components/create/create-included-excluded.tsx",
  "src/app/(workspace)/create/page.tsx",
  "src/components/create/create-step-skeleton.tsx",
  "src/components/create/workspace/app-dashboard-panel.tsx",
  "src/lib/import/zip-import-service.ts",
].forEach(mustExist);

mustNotExist("src/components/create/create-guided-flow.tsx", "create-guided-flow");

const pre = fs.readFileSync(path.join(root, "src/lib/ai/preflight-server.ts"), "utf8");
if (pre.includes("question_only")) ok.push("preflight blocks question_only");
else errors.push("preflight missing question_only gate");

const createPage = fs.readFileSync(path.join(root, "src/app/(workspace)/create/page.tsx"), "utf8");
if (createPage.includes("PremiumCreateFunnel") && !createPage.includes("ImmersiveWorkspace")) {
  ok.push("/create uses PremiumCreateFunnel only");
} else errors.push("/create must use PremiumCreateFunnel not ImmersiveWorkspace");

if (!createPage.includes("create-guided-flow") && !createPage.includes("CreateGuidedFlow")) {
  ok.push("/create does not import guided flow");
} else errors.push("/create must not import create-guided-flow");

const immersive = fs.readFileSync(
  path.join(root, "src/components/create/workspace/immersive-workspace.tsx"),
  "utf8",
);
if (!immersive.includes("CreateGuidedFlow")) ok.push("immersive has no duplicate guided flow");
else errors.push("immersive still embeds CreateGuidedFlow");

const blueprint = fs.readFileSync(path.join(root, "src/app/api/build/blueprint/route.ts"), "utf8");
if (blueprint.includes("stylePresetId")) ok.push("blueprint accepts stylePresetId");
else errors.push("blueprint missing stylePresetId");

const userCopy = [
  ["src/components/create/premium-create-funnel.tsx", "Describe your app"],
  ["src/components/create/create-intent-step.tsx", "question"],
  ["src/lib/create/create-flow-state.ts", "Choose a starting point"],
  ["src/lib/create/create-flow-state.ts", "Review the blueprint"],
  ["src/components/create/premium-create-funnel.tsx", "Choose the visual style"],
  ["src/components/create/create-credit-estimate.tsx", "Build depth"],
  ["src/components/create/premium-create-funnel.tsx", "Open builder"],
];

for (const [file, needle] of userCopy) {
  mustInclude(file, needle, `user copy: ${needle}`);
}

const creditUi = fs.readFileSync(path.join(root, "src/components/create/create-credit-estimate.tsx"), "utf8");
if (!/provider|modelId|gpt-|claude/i.test(creditUi)) ok.push("credit estimate hides provider/model jargon");
else errors.push("create-credit-estimate exposes provider/model jargon");

mustNotInclude(
  "src/components/create/premium-create-funnel.tsx",
  "JSON.stringify",
  "create funnel hides raw debug JSON",
);

const funnel = fs.readFileSync(path.join(root, "src/components/create/premium-create-funnel.tsx"), "utf8");
if (funnel.includes("CREATE_FLOW_STEP_ORDER.map") && !funnel.includes("slice(0, 7)")) {
  ok.push("create stepper shows all flow steps");
} else {
  errors.push("create stepper must show all 8 steps (no slice(0,7))");
}
if (funnel.includes("CreateStepSkeleton")) ok.push("create funnel uses step skeletons");
else errors.push("create funnel missing skeleton loading states");
if (funnel.includes("safe-area-pad-b") && funnel.includes("sticky bottom-0")) {
  ok.push("create sticky action bar mobile-safe");
} else {
  errors.push("create funnel missing mobile-safe sticky bar");
}

mustInclude("src/components/create/workspace/mode-switch.tsx", "disabledModes", "mode lock prop");
mustInclude("src/components/create/workspace/immersive-workspace.tsx", "Describe the app you want to create", "first prompt placeholder");
mustInclude("src/app/api/chat/route.ts", "edit_requires_project", "server edit guard");

function scanImports(dir, needle, label) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== "node_modules" && ent.name !== ".next") {
      scanImports(full, needle, label);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(ent.name)) continue;
    const text = fs.readFileSync(full, "utf8");
    if (text.includes(needle)) errors.push(`${label} import in ${path.relative(root, full)}`);
  }
}

scanImports(path.join(root, "src/app"), "create-guided-flow", "dead create-guided-flow");
scanImports(path.join(root, "src/components"), "create-guided-flow", "dead create-guided-flow");

console.log("\n=== verify:create-flow ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
