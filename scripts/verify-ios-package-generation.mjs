#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pipeline = fs.readFileSync(path.join(root, "src/lib/mobile/mobile-build-pipeline.ts"), "utf8");
const build = fs.readFileSync(path.join(root, "src/app/api/projects/[id]/mobile/build/route.ts"), "utf8");
const errors = [];

if (!pipeline.includes("iosPackageHonestStatus")) errors.push("iosPackageHonestStatus helper");
if (!pipeline.includes("Xcode")) errors.push("honest Xcode/IPA messaging");
if (!build.includes("iosPackageHonestStatus")) errors.push("iOS build route uses honest status");
const gen = fs.readFileSync(path.join(root, "src/lib/mobile/capacitor-generator.ts"), "utf8");
if (!gen.includes("README-MOBILE-WRAP")) errors.push("App Store metadata in wrapper README");

if (errors.length) {
  console.error("verify:ios-package-generation FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:ios-package-generation OK");
