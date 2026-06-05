#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  if (!fs.readFileSync(path.join(root, rel), "utf8").includes(needle)) errors.push(label);
};

must("src/lib/preview/detect-preview-routes.ts", "detectPreviewRoutes", "route detection module");
must("src/components/create/workspace/preview-page-switcher.tsx", "createPortal", "page list above iframe");
must("src/components/create/workspace/preview-page-switcher.tsx", "z-[20000]", "high z-index portal");
must("src/components/create/workspace/immersive-workspace.tsx", "detectPreviewRoutesFromFiles", "routes in workspace");

if (errors.length) {
  console.error("verify:route-discovery FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:route-discovery OK");
