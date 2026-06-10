#!/usr/bin/env node
/** P1.3.36 — universal preview error panel wired for all failure paths. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const panel = fs.readFileSync(path.join(root, "src/components/create/workspace/preview-panel.tsx"), "utf8");
const ui = fs.readFileSync(path.join(root, "src/components/preview/preview-universal-error-panel.tsx"), "utf8");

assert(fs.existsSync(path.join(root, "src/components/preview/preview-universal-error-panel.tsx")), "universal error panel exists");
assert(ui.includes("Copy technical details"), "copy technical details action");
assert(ui.includes("Repair preview state"), "repair preview state action");
assert(panel.includes("data-preview-canonical-state"), "preview panel exposes canonical state attr");
assert(panel.includes("PreviewUniversalErrorPanel"), "preview panel renders universal error UI");
assert(panel.includes("showUniversalError"), "universal error branch exists");
assert(panel.includes("loadingExceeded60s"), "60s loading timeout wired");

console.log("✓ verify:preview-universal-error-ui");
