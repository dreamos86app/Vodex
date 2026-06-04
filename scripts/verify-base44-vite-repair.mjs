#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    errors.push(`missing: ${rel}`);
    return;
  }
  if (!fs.readFileSync(p, "utf8").includes(needle)) errors.push(label);
};

must("worker/preview-worker/src/package-repair.ts", "repairPackageJsonContent", "package repair module");
must("worker/preview-worker/src/package-repair.ts", "assertViteBinaryPresent", "vite binary check");
must("worker/preview-worker/src/builders/vite-builder.ts", "applyPackageRepair", "vite builder repairs package");
must("worker/preview-worker/src/builders/run-command.ts", "NPM_CONFIG_PRODUCTION", "devDependencies install env");
must("worker/preview-worker/src/builders/run-command.ts", 'NODE_ENV: "development"', "development install NODE_ENV");
must("worker/preview-worker/src/package-repair.ts", "Vite dependency missing after install", "clear blocked reason");
must("worker/preview-worker/src/adapters/base44-adapter.ts", "__BASE44_PREVIEW_MOCK__", "base44 fetch mock");
must("src/components/apps/zip-import-wizard.tsx", 'step === "confirm"', "confirm step before import");
must("src/app/api/import/zip/preview/route.ts", "actionCreditBalance", "scan returns credit balance");

const repairSrc = fs.readFileSync(path.join(root, "worker/preview-worker/src/package-repair.ts"), "utf8");
if (!repairSrc.includes('devDependencies.vite')) errors.push("vite devDependency injection");

if (!fs.readFileSync(path.join(root, "package.json"), "utf8").includes("verify:base44-vite-repair")) {
  errors.push("verify:base44-vite-repair not in package.json");
}

if (errors.length) {
  console.error("verify:base44-vite-repair FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:base44-vite-repair OK");
