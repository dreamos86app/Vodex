#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (!src.includes(needle)) errors.push(label);
};

must("src/lib/preview/detect-preview-routes.ts", "detectPreviewRoutesFromFiles", "route detection");
must("src/components/create/workspace/preview-page-switcher.tsx", "PreviewPageSwitcher", "page switcher UI");
must("src/components/create/workspace/preview-panel.tsx", "PreviewPageSwitcher", "switcher in toolbar");

if (errors.length) {
  console.error("verify:preview-page-switcher FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:preview-page-switcher OK");
