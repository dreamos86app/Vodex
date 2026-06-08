#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const errors = [];
const repair = read("src/lib/build/generated-import-repair.ts");
if (!repair.includes("ensureGeneratedTsconfig")) errors.push("tsconfig ensure");
if (!repair.includes('"@/*"')) errors.push("path alias");

const prompts = read("src/lib/build/stage-prompts.ts");
if (!prompts.includes("tsconfig.json")) errors.push("frontend prompt tsconfig");

if (errors.length) {
  console.error("verify:generated-publish-package-files FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:generated-publish-package-files OK");
