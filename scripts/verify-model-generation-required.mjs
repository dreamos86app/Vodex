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
if (pipeline.includes("minimalFrontendPrompt(executionPrompt") && !pipeline.includes("smokeBuild")) {
  const lines = pipeline.split("\n").filter((l) => l.includes("minimalFrontendPrompt"));
  const unguarded = lines.filter((l) => !l.includes("smokeBuild"));
  if (unguarded.length) errors.push("minimalFrontendPrompt used outside smoke");
}

const cont = read("src/lib/build/generation-continuation.ts");
if (!cont.includes("generic_scaffold_detected")) errors.push("continuation generic scaffold");
if (!cont.includes("buildAntiScaffoldContinuationPrompt")) errors.push("anti-scaffold continuation");

if (!read("src/lib/build/build-production-mode.ts").includes("isProductionBuildMode")) {
  errors.push("production mode helper");
}

if (errors.length) {
  console.error("verify:model-generation-required FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:model-generation-required OK");
