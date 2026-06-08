#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const errors = [];
const guard = read("src/lib/build/plan-mode-guard.ts");
if (!guard.includes("isPlanFirstOnlyRequest")) errors.push("plan-mode-guard missing isPlanFirstOnlyRequest");
if (!guard.includes("shouldBlockBuildPipelineForPlan")) errors.push("plan-mode-guard missing shouldBlockBuildPipelineForPlan");

const workspace = read("src/components/create/workspace/immersive-workspace.tsx");
if (!workspace.includes("planOnlySubmit")) errors.push("immersive-workspace missing planOnlySubmit early return");
if (!workspace.includes('setLastApiUrl("/api/build/blueprint")')) {
  errors.push("plan mode must call blueprint API not chat build");
}
if (!workspace.includes("loadBlueprint(text)")) errors.push("plan mode must loadBlueprint");

const chat = read("src/app/api/chat/route.ts");
if (!chat.includes("planFirstOnly")) errors.push("chat route must respect planFirstOnly");
if (!/if \(planFirstOnly\)[\s\S]*startBuildPipeline = false/.test(chat)) {
  errors.push("chat route must block build when planFirstOnly");
}

if (errors.length) {
  console.error("verify:plan-mode-no-build FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:plan-mode-no-build OK");
