#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const errors = [];
if (!fs.existsSync(path.join(root, "src/lib/build/build-trace-artifact.ts"))) {
  errors.push("missing build-trace-artifact.ts");
}
if (!fs.existsSync(path.join(root, "scripts/debug-build-trace.ts"))) {
  errors.push("missing debug-build-trace.ts");
}
const artifact = read("src/lib/build/build-trace-artifact.ts");
for (const field of [
  "generic_scaffold_detected",
  "continuation_attempts",
  "logo_generation_status",
  "import_graph_status",
  "writeBuildTraceArtifactFile",
]) {
  if (!artifact.includes(field)) errors.push(`artifact field: ${field}`);
}
const pipeline = read("src/lib/build/build-pipeline.ts");
if (!pipeline.includes("persistBuildTraceArtifact")) errors.push("pipeline persists trace");

if (errors.length) {
  console.error("verify:build-trace-debugger FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:build-trace-debugger OK");
