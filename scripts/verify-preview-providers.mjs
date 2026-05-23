#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "src/lib/preview/preview-provider-types.ts",
  "src/lib/preview/preview-provider-registry.ts",
  "src/lib/preview/static-preview-builder.ts",
  "src/lib/preview/vercel-preview-provider.ts",
  "src/components/preview/preview-toolbar.tsx",
  "src/components/preview/preview-status-panel.tsx",
  "src/components/preview/preview-workspace.tsx",
];

const errors = [];
const ok = [];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(rel);
}

const reg = fs.readFileSync(path.join(root, "src/lib/preview/preview-provider-registry.ts"), "utf8");
const vercel = fs.readFileSync(path.join(root, "src/lib/preview/vercel-preview-provider.ts"), "utf8");
const types = fs.readFileSync(path.join(root, "src/lib/preview/preview-provider-types.ts"), "utf8");

if (reg.includes("attemptVercelPreview")) ok.push("Vercel provider wired in registry");
else errors.push("Vercel provider not wired");

if (reg.includes("PREVIEW_PROVIDER_CHAIN")) ok.push("explicit provider chain order");
else errors.push("missing PREVIEW_PROVIDER_CHAIN");

if (vercel.includes("not_connected")) ok.push("honest Vercel not_connected state");
else errors.push("missing not_connected copy");

if (vercel.includes("pollVercelPreviewUrl")) ok.push("Vercel URL polling helper");
else errors.push("missing Vercel poll helper");

if (types.includes("external_hosted")) ok.push("external_hosted provider level defined");
else errors.push("missing external_hosted type");

const dash = fs.readFileSync(path.join(root, "src/components/create/workspace/app-dashboard-panel.tsx"), "utf8");
if (dash.includes("PreviewWorkspace")) ok.push("PreviewWorkspace wired in dashboard");
else errors.push("PreviewWorkspace not wired");

const builder = fs.readFileSync(path.join(root, "src/components/builder/app-builder-workspace.tsx"), "utf8");
if (builder.includes("PreviewWorkspace")) ok.push("PreviewWorkspace wired in builder");
else errors.push("PreviewWorkspace not in builder");

const toolbar = fs.readFileSync(path.join(root, "src/components/preview/preview-toolbar.tsx"), "utf8");
if (toolbar.includes("Tablet") && toolbar.includes("Smartphone") && toolbar.includes("Copy link")) {
  ok.push("preview toolbar viewport + share controls");
} else errors.push("preview toolbar missing controls");

console.log("\n=== verify:preview-providers ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
