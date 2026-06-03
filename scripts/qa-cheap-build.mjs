#!/usr/bin/env node
/**
 * P1.8 — Cheap-model build QA checklist (static contract).
 * Run full generation in CI/staging with: npm run qa:cheap-build
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const PROMPT =
  "Build a simple client portal with login, dashboard, tasks, files, messages, and settings. Make it mobile-ready and publish-ready.";

const required = [
  "src/lib/build/persist-generated-files.ts",
  "src/lib/generated-apps/mobile-baseline.ts",
  "src/lib/build/inject-mobile-baseline.ts",
  "src/lib/build/stage-prompts.ts",
  "src/components/publish/publish-status-panel.tsx",
  "src/components/create/workspace/app-dashboard-panel.tsx",
];

let failed = 0;

console.log("QA cheap build — prompt contract:\n", PROMPT, "\n");

for (const rel of required) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    console.error(`MISSING ${rel}`);
    failed++;
  }
}

const stage = fs.readFileSync(path.join(root, "src/lib/build/stage-prompts.ts"), "utf8");
if (!stage.includes("app/page.tsx")) {
  console.error("stage-prompts must require app/page.tsx");
  failed++;
}

const mobile = fs.readFileSync(path.join(root, "src/lib/generated-apps/mobile-baseline.ts"), "utf8");
if (!mobile.includes("manifest.webmanifest")) {
  console.error("mobile baseline missing manifest");
  failed++;
}

if (failed) {
  console.error("\nqa:cheap-build FAILED (static checks)");
  process.exit(1);
}

console.log("qa:cheap-build OK — static prerequisites for cheap client-portal generation");
