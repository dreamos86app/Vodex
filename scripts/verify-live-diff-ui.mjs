#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const stream = fs.readFileSync(
  path.join(root, "src/components/create/workspace/agent-workflow-stream.tsx"),
  "utf8",
);

if (!stream.includes("AnimatedLineDelta") || !stream.includes('data-testid="workflow-file-card"')) {
  console.error("✗ workflow file diff UI missing");
  process.exit(1);
}
if (!stream.includes('const prefix = isDelete ? "−"')) {
  console.error("✗ +/- prefix display missing");
  process.exit(1);
}
console.log("✓ verify:live-diff-ui passed");
