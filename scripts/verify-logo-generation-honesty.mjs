#!/usr/bin/env node
/** P1.3.15 — Honest logo generation / fallback messaging */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const errors = [];
const thinking = read("src/lib/build/build-thinking-messages.ts");
for (const phrase of [
  "Logo skipped — not enough Action Credits",
  "Logo generation failed",
  "image provider is not configured",
  "temporary placeholder",
]) {
  if (!thinking.includes(phrase)) errors.push(`icon copy: ${phrase}`);
}

const identity = read("src/lib/projects/app-identity-service.ts");
if (!identity.includes("logoGenerationStatus")) errors.push("logo status stored");
if (!identity.includes("iconGenerationMode")) errors.push("icon generation mode");

if (errors.length) {
  console.error("verify:logo-generation-honesty FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:logo-generation-honesty OK");
