#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pipeline = fs.readFileSync(path.join(root, "src/lib/mobile/mobile-build-pipeline.ts"), "utf8");
const build = fs.readFileSync(path.join(root, "src/app/api/projects/[id]/mobile/build/route.ts"), "utf8");
const errors = [];

if (!pipeline.includes('"aab"')) errors.push("aab artifact type in pipeline");
if (!build.includes('"aab"')) errors.push("aab in build route schema");
if (!pipeline.includes("requires_builder_config")) errors.push("AAB does not fake success without builder");
if (!build.includes("artifactCheck.verified")) errors.push("AAB path still verifies wrapper artifact");

if (errors.length) {
  console.error("verify:aab-generation FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:aab-generation OK");
