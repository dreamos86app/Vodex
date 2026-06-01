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

must("src/lib/clipboard/copy-text.ts", "writeText", "clipboard API");
must("src/lib/clipboard/copy-text.ts", "execCommand", "textarea fallback");
must("src/components/create/workspace/build-diagnostics-center.tsx", "copyTextToClipboard", "uses copy helper");
must("src/components/create/workspace/build-diagnostics-center.tsx", "toast.success", "success toast");
must("src/lib/build/build-diagnostics.ts", "buildCopyFixPrompt", "fix prompt builder");

console.log("\n=== verify:copy-fix-prompt ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
