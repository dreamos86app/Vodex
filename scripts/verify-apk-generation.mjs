#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pipeline = fs.readFileSync(path.join(root, "src/lib/mobile/mobile-build-pipeline.ts"), "utf8");
const build = fs.readFileSync(path.join(root, "src/app/api/projects/[id]/mobile/build/route.ts"), "utf8");
const errors = [];

if (!pipeline.includes('"apk"')) errors.push("apk artifact type in pipeline");
if (!build.includes('"apk"')) errors.push("apk in build route schema");
if (!pipeline.includes("requires_builder_config")) errors.push("APK does not fake success without builder");
if (!build.includes("WRAP_ANDROID_WEBHOOK_URL")) errors.push("external Android builder env documented");
if (build.includes('status: "success"') && !build.includes("honest.buildSuccess")) {
  errors.push("success status tied to honest.buildSuccess");
}

if (errors.length) {
  console.error("verify:apk-generation FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:apk-generation OK");
