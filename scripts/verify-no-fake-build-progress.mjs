#!/usr/bin/env node
/** P1.3.15 — No fake instant stages / silent gaps */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const errors = [];
const orchestrator = read("src/lib/build/build-stage-orchestrator.ts");
if (!orchestrator.includes("honest: true")) errors.push("stage metadata honest flag");
if (!orchestrator.includes("duration_ms")) errors.push("stage duration_ms");

const worker = read("src/lib/build/execute-staged-build-job.ts");
if (!worker.includes("progressForStep = () => Math.min")) errors.push("progressForStep implemented");
if (!worker.includes(", 2000)")) errors.push("2s heartbeat interval");
if (!worker.includes("persistAssistantBuildMessage")) errors.push("visible heartbeat messages");

const facing = read("src/lib/workflow/user-facing-workflow-events.ts");
if (!facing.includes('stream_category !== "assistant_message"')) {
  errors.push("assistant heartbeats visible");
}

if (errors.length) {
  console.error("verify:no-fake-build-progress FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:no-fake-build-progress OK");
