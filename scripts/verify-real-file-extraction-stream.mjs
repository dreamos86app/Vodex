#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const errors = [];
const pipeline = read("src/lib/build/build-pipeline.ts");
if (!pipeline.includes("Model response received — extracting files")) {
  errors.push("extraction start message");
}
if (!pipeline.includes("interFileDelayMs: isProductionBuildMode() ? 550")) {
  errors.push("production extraction delay");
}
if (!pipeline.includes("extraction_stream: true")) errors.push("extraction_stream metadata");
if (!pipeline.includes("file_rewritten")) errors.push("file_rewritten tracking");

if (errors.length) {
  console.error("verify:real-file-extraction-stream FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:real-file-extraction-stream OK");
