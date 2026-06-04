#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function mustInclude(file, needles, label) {
  const rel = path.relative(root, file);
  if (!fs.existsSync(file)) {
    errors.push(`missing file: ${rel}`);
    return;
  }
  const src = fs.readFileSync(file, "utf8");
  for (const n of needles) {
    if (!src.includes(n)) errors.push(`${label ?? rel}: missing "${n}"`);
  }
}

mustInclude(
  path.join(root, "worker/preview-worker/src/build-memory.ts"),
  [
    "PREVIEW_NODE_MAX_OLD_SPACE_MB",
    "previewBuildEnv",
    "isOomOutput",
    "VITE_BUILD_OOM",
    "PREVIEW_WORKER_MEMORY_TOO_LOW",
    "validateBuildMemoryAtStartup",
  ],
  "build-memory.ts",
);

mustInclude(
  path.join(root, "worker/preview-worker/src/config.ts"),
  ["nodeMaxOldSpaceMb", "PREVIEW_NODE_MAX_OLD_SPACE_MB"],
  "config.ts",
);

mustInclude(
  path.join(root, "worker/preview-worker/src/builders/run-command.ts"),
  ["previewBuildEnv", '["build"]'],
  "run-command.ts",
);

mustInclude(
  path.join(root, "worker/preview-worker/src/builders/vite-builder.ts"),
  ["Vite build out of memory", "VITE_BUILD_OOM", "isOomOutput", "nodeMaxOldSpaceMb"],
  "vite-builder.ts",
);

mustInclude(
  path.join(root, "worker/preview-worker/src/vite-config-repair.ts"),
  ["sourcemap: false", 'minify: "esbuild"', "chunkSizeWarningLimit"],
  "vite-config-repair.ts",
);

mustInclude(
  path.join(root, "worker/preview-worker/src/startup-checks.ts"),
  ["validateBuildMemoryAtStartup"],
  "startup-checks.ts",
);

const readme = path.join(root, "worker/preview-worker/README.md");
if (fs.existsSync(readme)) {
  const r = fs.readFileSync(readme, "utf8");
  if (!/512\s*MB|1\s*GB|2\s*GB|4\s*GB/i.test(r)) {
    errors.push("worker README missing Railway memory tier guidance");
  }
} else {
  errors.push("missing worker/preview-worker/README.md");
}

const wizard = path.join(root, "src/components/apps/zip-import-wizard.tsx");
mustInclude(wizard, ["ZIP import flow version: P3.5", "Estimated Preview Cost"], "zip-import-wizard");

const credits = path.join(root, "src/lib/imports/zip-preview-action-credits.ts");
mustInclude(credits, ["dependencySurchargeCredits", "sizeBaseCredits"], "zip-preview-action-credits");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (!pkg.scripts?.["verify:preview-worker-oom-handling"]) {
  errors.push("verify:preview-worker-oom-handling not registered in package.json");
}

if (errors.length) {
  console.error("verify:preview-worker-oom-handling FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:preview-worker-oom-handling OK");
