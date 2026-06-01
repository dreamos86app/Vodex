#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const home = fs.readFileSync(path.join(root, "src/components/os-home/os-home.tsx"), "utf8");
const errors = [];
const ok = [];

if (home.includes("ModelUsageDonut")) {
  errors.push("os-home still imports/renders ModelUsageDonut");
} else {
  ok.push("Model usage removed from Home");
}

if (home.includes("model-usage-donut")) {
  errors.push("os-home still references model-usage-donut");
} else {
  ok.push("no model-usage-donut import");
}

console.log("\n=== verify:home-no-model-usage ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
