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
  if (!fs.readFileSync(p, "utf8").includes(needle)) errors.push(label);
};

must("src/lib/imports/zip-preview-action-credits.ts", "reserveZipPreviewActionCredits", "reserve holds");
must("src/lib/imports/zip-preview-action-credits.ts", "captureZipPreviewActionCredits", "capture after success");
must("src/lib/imports/zip-preview-action-credits.ts", "refundZipPreviewActionCredits", "refund/cancel holds");
must("src/lib/imports/zip-preview-action-credits.ts", 'status: "reserved"', "reserved status");
must("src/lib/imports/zip-preview-action-credits.ts", 'status: "charged"', "charged status");
must("src/lib/imports/zip-preview-action-credits.ts", 'status: "cancelled"', "cancelled without charge");
must("src/app/api/projects/import-zip/route.ts", "reserveZipPreviewActionCredits", "import reserves credits");
must("src/app/api/projects/import-zip/route.ts", "refundZipPreviewActionCredits", "import refunds on failure");
must("src/app/api/projects/import-zip/route.ts", "captureZipPreviewActionCredits", "import captures on inline success");
must("worker/preview-worker/src/zip-credits.ts", "captureZipPreviewCredits", "worker captures credits");
must("src/lib/action-credits/action-catalog.ts", "zip_preview_build", "zip_preview_build action type");

if (!fs.readFileSync(path.join(root, "package.json"), "utf8").includes("verify:zip-credit-refund")) {
  errors.push("verify script not registered");
}

if (errors.length) {
  console.error("verify:zip-credit-refund FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:zip-credit-refund OK");
