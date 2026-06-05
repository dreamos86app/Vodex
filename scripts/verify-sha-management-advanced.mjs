#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const reg = fs.readFileSync(path.join(root, "src/lib/mobile/sha-key-registry.ts"), "utf8");
const errors = [];

const labels = ["upload_key", "play_signing_key", "legacy_key", "firebase_key", "custom_key"];
for (const l of labels) {
  if (!reg.includes(l)) errors.push(`label ${l}`);
}
if (!reg.includes("mergeShaRegistry")) errors.push("mergeShaRegistry");
if (!reg.includes("duplicates")) errors.push("duplicate detection");
if (!reg.includes("exportShaRegistryJson")) errors.push("export JSON");
if (!reg.includes("isValidShaFingerprint")) errors.push("fingerprint validation");
if (!reg.includes("play_sha256_entries")) errors.push("structured sha256 entries");

if (errors.length) {
  console.error("verify:sha-management-advanced FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:sha-management-advanced OK");
