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

must("src/components/create/workspace/animated-line-delta.tsx", "AnimatedLineDelta", "component");
must("src/components/create/workspace/animated-line-delta.tsx", "requestAnimationFrame", "rAF animation");
must("src/components/create/workspace/agent-workflow-stream.tsx", "AnimatedLineDelta", "used in file rows");

console.log("\n=== verify:animated-file-deltas ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
