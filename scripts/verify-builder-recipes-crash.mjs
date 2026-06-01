#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function must(rel, needle, label) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (!src.includes(needle)) errors.push(`${rel} missing ${label}`);
  else ok.push(label);
}

const stream = fs.readFileSync(
  path.join(root, "src/components/create/workspace/agent-workflow-stream.tsx"),
  "utf8",
);
if (stream.includes("progress?.events[0]") && !stream.includes("progress?.events?.[0]")) {
  errors.push("agent-workflow-stream still uses unsafe progress?.events[0]");
} else {
  ok.push("null-safe events[0] access");
}
must("src/components/create/workspace/agent-workflow-stream.tsx", "if (!progress) return null", "early null guard after hooks");
must("src/components/create/workspace/build-live-progress.tsx", "if (!progress) return null", "build-live null guard");

console.log("\n=== verify:builder-recipes-crash ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
