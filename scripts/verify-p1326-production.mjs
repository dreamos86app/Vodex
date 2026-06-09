#!/usr/bin/env node
/**
 * P1.3.26 — Absolute preview-html URLs + ZIP preview credit capture.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function must(src, needle, label, errors) {
  if (!src.includes(needle)) errors.push(label);
}

const suites = {
  "preview-html-url-absolute": () => {
    const errors = [];
    const url = read("src/lib/preview/internal-preview-url.ts");
    must(url, "assertInternalPreviewUrl", "assert guard", errors);
    must(url, '"/api/projects/"', "absolute prefix guard", errors);
    must(url, "buildInternalPreviewHtmlUrl", "url builder", errors);
    must(url, "toPreviewIframeSrc", "iframe origin helper", errors);
    must(read("src/lib/preview/rewrite-preview-artifact-html.ts"), "buildInternalPreviewHtmlUrl", "frame url uses builder", errors);
    must(read("src/components/create/workspace/preview-panel.tsx"), "toPreviewIframeSrc", "panel uses iframe src helper", errors);
    return errors;
  },
  "zip-preview-no-relative-api-route": () => {
    const errors = [];
    must(read("src/lib/preview/internal-preview-url.ts"), 'startsWith("api/projects/")', "fixes missing slash", errors);
    must(read("src/lib/preview/inject-preview-virtual-history.ts"), "api/projects/", "blocks relative api route in SPA", errors);
    must(read("src/components/projects/project-banner.tsx"), "tryNormalizeInternalPreviewUrl", "banner normalizes url", errors);
    must(read("src/lib/imports/apply-preview-build-to-project.ts"), "tryNormalizeInternalPreviewUrl", "persist normalized url", errors);
    return errors;
  },
  "zip-preview-credit-reservation": () => {
    const errors = [];
    must(read("src/lib/imports/zip-preview-action-credits.ts"), "reserveZipPreviewActionCredits", "reserve helper", errors);
    must(read("src/app/api/projects/import-zip/route.ts"), "reserveZipPreviewActionCredits", "import reserves on build", errors);
    must(read("src/lib/imports/preview-build-queue.ts"), "credit_reservation_id", "job stores reservation id", errors);
    must(read("src/lib/imports/preview-build-queue.ts"), 'credit_status: "reserved"', "job credit_status reserved", errors);
    return errors;
  },
  "zip-preview-credit-capture-on-success": () => {
    const errors = [];
    must(read("src/lib/imports/zip-preview-action-credits.ts"), "captureZipPreviewActionCredits", "platform capture", errors);
    must(read("worker/preview-worker/src/zip-credits.ts"), "captureZipPreviewCredits", "worker capture", errors);
    must(read("src/lib/imports/zip-preview-credit-reconcile.ts"), "reconcileZipPreviewCreditCapture", "runtime reconcile capture", errors);
    must(read("src/lib/preview/load-preview-runtime-status.ts"), "reconcileZipPreviewCreditCapture", "status polls reconcile", errors);
    must(read("worker/preview-worker/src/job-runner.ts"), "captureZipPreviewCredits", "worker captures on success", errors);
    return errors;
  },
  "zip-preview-credit-release-on-failure": () => {
    const errors = [];
    must(read("src/lib/imports/zip-preview-action-credits.ts"), "refundZipPreviewActionCredits", "refund helper", errors);
    must(read("src/lib/imports/zip-preview-credit-reconcile.ts"), 'credit_status: "released"', "release metadata", errors);
    must(read("worker/preview-worker/src/zip-credits.ts"), "cancelZipPreviewHold", "worker cancels hold on fail", errors);
    must(read("src/app/api/projects/import-zip/route.ts"), "refundZipPreviewActionCredits", "import refunds on fail", errors);
    return errors;
  },
};

const only = process.argv[2];
const names = only && only !== "all" ? [only] : Object.keys(suites);
let failed = 0;
for (const name of names) {
  const errors = suites[name]?.();
  if (!errors) {
    console.error(`Unknown suite: ${name}`);
    failed += 1;
    continue;
  }
  if (errors.length) {
    console.error(`FAIL verify:${name}`);
    for (const e of errors) console.error(`  - ${e}`);
    failed += 1;
  } else {
    console.log(`OK verify:${name}`);
  }
}
process.exit(failed ? 1 : 0);
