#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const errors = [];
const graph = read("src/lib/build/import-graph.ts");
if (!graph.includes("findMissingAliasImports")) errors.push("alias imports");
if (!graph.includes("findAllMissingImports")) errors.push("findAllMissingImports");

const repair = read("src/lib/build/generated-import-repair.ts");
if (!repair.includes("repairGeneratedImportGraph")) errors.push("repairGeneratedImportGraph");
if (!repair.includes("lib/mock-data.ts")) errors.push("mock-data repair");

const pipeline = read("src/lib/build/build-pipeline.ts");
if (!pipeline.includes("repairGeneratedImportGraph")) errors.push("pipeline import repair");

if (errors.length) {
  console.error("verify:generated-import-graph FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:generated-import-graph OK");
