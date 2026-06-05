#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const cap = fs.readFileSync(path.join(root, "src/lib/mobile/capacitor-generator.ts"), "utf8");

if (!cap.includes("splash_duration_ms")) errors.push("capacitor uses splash_duration_ms");
if (!cap.includes("launchShowDuration")) errors.push("SplashScreen.launchShowDuration");
if (!cap.includes("splashScreenFadeOutDuration")) errors.push("TWA splash fade duration");
if (!fs.readFileSync(path.join(root, "src/lib/mobile/eligibility-report.ts"), "utf8").includes("splash_duration")) {
  errors.push("eligibility validates splash duration");
}

if (errors.length) {
  console.error("verify:splash-generation FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:splash-generation OK");
