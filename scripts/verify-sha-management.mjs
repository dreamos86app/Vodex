#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const gen = fs.readFileSync(path.join(root, "src/lib/mobile/capacitor-generator.ts"), "utf8");
const studio = fs.readFileSync(
  path.join(root, "src/components/mobile/mobile-wrapper-studio.tsx"),
  "utf8",
);
const errors = [];

if (!gen.includes("play_sha256_fingerprints")) {
  errors.push("capacitor-generator reads play_sha256_fingerprints array");
}
if (gen.includes('["REPLACE_WITH_YOUR_SHA256_FINGERPRINT"]') && !gen.includes("sha256List.length")) {
  errors.push("sha256 should use array when configured");
}
if (!studio.includes("shaRegistryToStoreDraft") && !studio.includes("play_sha256_fingerprints")) {
  errors.push("studio saves sha256 via registry");
}
if (!studio.includes("mergeShaRegistry") && !studio.includes("play_sha1_fingerprints")) {
  errors.push("studio saves sha1 via registry");
}
if (gen.match(/sha256_cert_fingerprints:\s*\[/g)?.length < 1) {
  errors.push("assetlinks uses fingerprints array");
}

if (errors.length) {
  console.error("verify:sha-management FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:sha-management OK");
