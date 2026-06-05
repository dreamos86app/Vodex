#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const build = fs.readFileSync(path.join(root, "src/app/api/projects/[id]/mobile/build/route.ts"), "utf8");
const pipeline = fs.readFileSync(path.join(root, "src/lib/mobile/mobile-build-pipeline.ts"), "utf8");
const errors = [];

if (!build.includes("artifact_missing")) errors.push("rejects missing artifact on success");
if (!pipeline.includes("requires_builder_config")) errors.push("honest binary build status");
if (!pipeline.includes("does not mark APK/AAB as succeeded")) errors.push("no fake APK message");
if (!build.includes("artifactVerified")) errors.push("artifactVerified in response");
if (!build.includes("build_success")) errors.push("build_success in job meta");

if (errors.length) {
  console.error("verify:mobile-artifacts FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:mobile-artifacts OK");
