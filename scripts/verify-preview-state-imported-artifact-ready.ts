#!/usr/bin/env npx tsx
/** P1.3.36 — imported ZIP with succeeded job + artifact resolves to ready. */
import { resolvePreviewState } from "../src/lib/preview/resolve-preview-state";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const importedMeta = {
  source: "zip_import",
  import: { file_count: 1353, framework: { id: "next", label: "Next.js" } },
  preview_renderable: true,
};

const runtime = {
  previewRenderable: true,
  previewHonest: true,
  previewStatus: "ready",
  jobStatus: "succeeded",
  jobId: "267e0278-d333-41e8-82ef-f8c309749df8",
  framework: "next",
  frameworkLabel: "Next.js",
  artifactPath: "30066b29/267e0278-d333-41e8-82ef-f8c309749df8",
  blockedReason: null,
  errorCode: null,
  userMessage: null,
  buildLogs: null,
  lockedBy: null,
  workerUnavailable: false,
  workerConnected: true,
  workerUnavailableMessage: null,
  jobCreatedAt: null,
  jobAgeLabel: null,
  jobAgeSeconds: null,
  requiresDeployedWorker: false,
  lastPreviewBuildAt: null,
  entryFile: null,
  warnings: [],
  previewBuildMeta: null,
  packageRepairDiagnostics: null,
  estimatedActionCredits: null,
  chargedActionCredits: null,
  creditsCharged: false,
  chargeStatus: null,
  previewFailureKind: null,
  previewFailureDetail: null,
  previewSource: "worker_job" as const,
};

const ready = resolvePreviewState({
  projectId: "30066b29-15fa-41cf-9a6e-4111418be3e5",
  projectMetadata: importedMeta,
  projectFileCount: 0,
  legacyCanPreview: false,
  runtimeStatus: runtime,
  iframeSrc: "https://vodex.dev/preview-runtime/30066b29-267e0278/",
  urlResolution: {
    source: "rebuilt_canonical",
    normalizedPreviewUrl: "/preview-runtime/30066b29/267e0278/",
    iframeSrc: "https://vodex.dev/preview-runtime/30066b29/267e0278/",
    artifactId: "267e0278-d333-41e8-82ef-f8c309749df8",
    route: "/",
    selectedPreviewUrl: null,
    cacheBust: null,
    wasNormalized: true,
    wasRejected: false,
    rejectReason: null,
    candidates: [],
  },
});

assert(ready.state === "ready", `expected ready, got ${ready.state}`);
assert(ready.showIframe === true, "ready must show iframe");
assert(ready.showGenerationContinuingCopy === false, "imported artifact ready must not show generation copy");

const aiBlocked = resolvePreviewState({
  projectMetadata: {},
  projectFileCount: 1,
  legacyCanPreview: false,
  runtimeStatus: null,
});

assert(aiBlocked.state === "ai_generation_incomplete", `expected ai_generation_incomplete, got ${aiBlocked.state}`);
assert(aiBlocked.showGenerationContinuingCopy === true, "AI incomplete should show generation copy");

console.log("✓ verify:preview-state-imported-artifact-ready");
