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

must("src/components/create/workspace/live-file-line-delta.tsx", "LiveFileLineDelta", "component");
must("src/components/create/workspace/live-file-line-delta.tsx", "AnimatedLineDelta", "real deltas");
must("src/components/create/workspace/animated-line-delta.tsx", "text-blue-500", "blue plus");
must("src/components/create/workspace/animated-line-delta.tsx", "text-red-500", "red minus");
must("src/components/create/workspace/agent-workflow-stream.tsx", "LiveFileLineDelta", "used in file rows");

console.log("\n=== verify:animated-file-deltas ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
