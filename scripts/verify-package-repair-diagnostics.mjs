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

must("worker/preview-worker/src/package-repair-diagnostics.ts", "VITE_BINARY_MISSING_AFTER_INSTALL", "error code constant");
must("worker/preview-worker/src/package-repair.ts", "package-repair: original package.json", "repair logs to stdout");
must("worker/preview-worker/src/package-repair.ts", "repairChanged", "repairChanged flag");
must("worker/preview-worker/src/builders/vite-builder.ts", "vite-builder: before install", "pre-install logs");
must("worker/preview-worker/src/builders/vite-builder.ts", "post-install", "post-install logs");
must("worker/preview-worker/src/builders/run-command.ts", "runViteBuild", "direct vite CLI build");
must("worker/preview-worker/src/resolve-npm-root.ts", "resolveNpmProjectLayout", "nested package.json root");
must("worker/preview-worker/src/job-runner.ts", "packageRepairDiagnostics", "persist repair diagnostics");
must("src/app/api/projects/[id]/preview/runtime-status/route.ts", "packageRepairDiagnostics", "API exposes diagnostics");
must("src/components/create/workspace/preview-runtime-status-panel.tsx", "Package repair executed", "UI repair panel");
must("src/lib/preview/preview-runtime-status.ts", "packageRepairDiagnostics", "runtime status type");

if (!fs.readFileSync(path.join(root, "package.json"), "utf8").includes("verify:package-repair-diagnostics")) {
  errors.push("verify script not registered");
}

if (errors.length) {
  console.error("verify:package-repair-diagnostics FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:package-repair-diagnostics OK");
