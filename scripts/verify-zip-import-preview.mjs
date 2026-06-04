#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    errors.push(`missing: ${rel}`);
    return;
  }
  const src = fs.readFileSync(p, "utf8");
  if (!src.includes(needle)) errors.push(label);
};

must("src/lib/import/imported-app-validator.ts", "previewReady = false", "validator does not fake preview");
must("src/lib/imports/framework-detector.ts", "detectImportedFramework", "framework detector");
must("src/lib/imports/base44-lovable-adapter.ts", "injectPreviewShims", "preview shims");
must("src/lib/imports/preview-health-check.ts", "previewRenderable", "health check");
must("src/app/api/projects/import-zip/route.ts", "runProjectPreviewBuild", "zip import runs preview build");
must("src/app/api/projects/import-zip/route.ts", "PREVIEW_WORKER_NOT_CONNECTED", "worker gate on import");
must("src/app/api/projects/import-zip/route.ts", "reserveZipPreviewActionCredits", "zip import reserves credits");
must("src/app/api/import/zip/preview/route.ts", "estimateZipPreviewCreditsWithPlatformMultiplier", "scan estimates credits");
must("src/components/apps/zip-import-wizard.tsx", 'step === "confirm"', "wizard confirm step before import");
must("src/components/apps/zip-import-wizard.tsx", "actionCreditBalance", "wizard shows credit balance");
must("src/components/apps/zip-import-wizard.tsx", "Preview Build Summary", "wizard preview build summary");
must("src/components/apps/zip-import-wizard.tsx", "Build Preview (", "wizard build preview CTA");
must("src/components/apps/zip-import-wizard.tsx", "NOT charging Action Credits", "wizard not-charged notice");
must("src/lib/import/zip-import-limits.ts", "ZIP_IMPORT_MAX_MB = 250", "250MB zip limit");
must("src/lib/imports/preview-build-queue.ts", "loadPreviewWorkerStatus", "queue refuses offline worker");
must("src/lib/publish/publish-readiness.ts", "preview_renderable", "publish gates on renderable");

if (errors.length) {
  console.error("verify:zip-import-preview FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:zip-import-preview OK");
