#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = false;

function mustInclude(file, needle, label) {
  if (!fs.readFileSync(path.join(root, file), "utf8").includes(needle)) {
    console.error(`✗ ${label}`);
    failed = true;
  } else console.log(`✓ ${label}`);
}

mustInclude("src/lib/navigation/chunk-load-recovery.ts", "isChunkLoadError", "chunk error detect");
mustInclude("src/lib/navigation/chunk-load-recovery.ts", "safeChunkReloadOnce", "safe reload once");
mustInclude("src/app/(app)/error.tsx", "isChunkLoadError", "error boundary chunk handling");
mustInclude("src/components/providers/app-provider.tsx", "installChunkLoadRecovery", "global chunk listener");
mustInclude("src/app/(app)/page.tsx", "dynamic(", "home route code split");

process.exit(failed ? 1 : 0);
