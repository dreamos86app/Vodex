#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const errors = [];
const trace = read("src/lib/build/build-trace-artifact.ts");
if (!trace.includes("max_silent_gap_ms")) errors.push("stream health max_silent_gap_ms");
if (!trace.includes("computeStreamHealthFromEvents")) errors.push("stream health computer");

const pipeline = read("src/lib/build/build-pipeline.ts");
if (!pipeline.includes("computeStreamHealthFromEvents")) errors.push("pipeline stream health");

if (errors.length) {
  console.error("verify:no-silent-build-gaps FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:no-silent-build-gaps OK");
