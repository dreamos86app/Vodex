#!/usr/bin/env node
/**
 * Ensures preview worker boots without inherited NODE_OPTIONS and only passes
 * a numeric heap flag to Vite child processes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const worker = path.join(root, "worker/preview-worker");
const errors = [];

function mustInclude(file, needles, label) {
  const rel = path.relative(root, file);
  if (!fs.existsSync(file)) {
    errors.push(`missing: ${rel}`);
    return;
  }
  const src = fs.readFileSync(file, "utf8");
  for (const n of needles) {
    if (!src.includes(n)) errors.push(`${label ?? rel}: missing "${n}"`);
  }
}

function mustNotInclude(file, needles, label) {
  const rel = path.relative(root, file);
  if (!fs.existsSync(file)) return;
  const src = fs.readFileSync(file, "utf8");
  for (const n of needles) {
    if (src.includes(n)) errors.push(`${label ?? rel}: must not include "${n}"`);
  }
}

// Repo-wide: no shell-interpolated heap
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next" || ent.name === "dist") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|js|mjs|sh|json|Dockerfile|md|toml|env\.example)$/i.test(ent.name)) acc.push(p);
  }
  return acc;
}

for (const file of walk(worker)) {
  if (file.endsWith("README.md")) continue;
  const src = fs.readFileSync(file, "utf8");
  if (/\$4096/.test(src) || /--max-old-space-size=\$4096/.test(src)) {
    errors.push(`bad heap interpolation in ${path.relative(root, file)}`);
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(worker, "package.json"), "utf8"));
if (pkg.scripts?.start?.includes("NODE_OPTIONS")) {
  errors.push("package.json start script must not set NODE_OPTIONS");
}
if (!pkg.scripts?.start?.includes("start.sh") && !pkg.scripts?.start?.includes("sh ")) {
  errors.push('package.json start should invoke start.sh (e.g. "sh start.sh")');
}

mustNotInclude(path.join(worker, "Dockerfile"), ["NODE_OPTIONS=", "harmony-import", "experimental-wasm"], "Dockerfile");
mustInclude(path.join(worker, "Dockerfile"), ["start.sh", "./start.sh"], "Dockerfile uses start.sh");

mustInclude(path.join(worker, "start.sh"), ["unset NODE_OPTIONS", "node dist/index.js"], "start.sh");

mustInclude(
  path.join(worker, "src/sanitize-node-options.ts"),
  ["childBuildNodeOptions", "sanitizeInheritedNodeOptionsForWorkerBoot", "UNSAFE_NODE_OPTIONS"],
  "sanitize-node-options.ts",
);

mustInclude(
  path.join(worker, "src/build-memory.ts"),
  ["childBuildNodeOptions", "NODE_OPTIONS: childBuildNodeOptions"],
  "build-memory.ts",
);

mustNotInclude(
  path.join(worker, "src/build-memory.ts"),
  ["${existing}", "return `${existing}"],
  "build-memory must not merge inherited NODE_OPTIONS",
);

mustInclude(path.join(worker, "src/index.ts"), ["sanitizeInheritedNodeOptionsForWorkerBoot"], "index.ts");

const bm = fs.readFileSync(path.join(worker, "src/build-memory.ts"), "utf8");
if (bm.includes("process.env.NODE_OPTIONS?.trim()") && bm.includes("mergeNodeOptions")) {
  const mergeBody = bm.slice(bm.indexOf("mergeNodeOptions"), bm.indexOf("previewBuildEnv"));
  if (mergeBody.includes("existing")) {
    errors.push("mergeNodeOptions still merges process.env.NODE_OPTIONS");
  }
}

const pkgRoot = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (!pkgRoot.scripts?.["verify:preview-worker-node-options"]) {
  errors.push("verify:preview-worker-node-options not in root package.json");
}

if (errors.length) {
  console.error("verify:preview-worker-node-options FAILED\n");
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
console.log("verify:preview-worker-node-options OK");
