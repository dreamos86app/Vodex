#!/usr/bin/env node
/**
 * P1.3.25 — ZIP auto-repair, honest preview failures, stale build recovery, clean build UX.
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

function mustNot(src, needle, label, errors) {
  if (src.includes(needle)) errors.push(label);
}

const suites = {
  "zip-auto-repair-engine": () => {
    const errors = [];
    const engine = read("src/lib/imports/zip-auto-repair-engine.ts");
    const types = read("src/lib/imports/zip-auto-repair-types.ts");
    const apply = read("src/lib/imports/apply-zip-auto-repair.ts");
    must(types, "ZipAutoRepairResult", "repair result type", errors);
    must(engine, "runZipAutoRepairEngine", "repair engine entry", errors);
    must(engine, "repairActions", "repair actions", errors);
    must(engine, "canBuild", "canBuild flag", errors);
    must(apply, "zip_auto_repair", "metadata persistence", errors);
    must(read("src/lib/imports/run-project-preview-build.ts"), "applyZipAutoRepair", "wired before build", errors);
    return errors;
  },
  "next-import-auto-repair": () => {
    const errors = [];
    const engine = read("src/lib/imports/zip-auto-repair-engine.ts");
    must(engine, "repairNext", "next repair", errors);
    must(engine, "tsconfig.json", "tsconfig repair", errors);
    must(engine, "next-env.d.ts", "next-env repair", errors);
    must(engine, "use client", "error boundary repair", errors);
    must(engine, '"@/*": ["./*"]', "path alias repair", errors);
    must(engine, "next build", "build script repair", errors);
    return errors;
  },
  "vite-import-auto-repair": () => {
    const errors = [];
    const engine = read("src/lib/imports/zip-auto-repair-engine.ts");
    must(engine, "repairVite", "vite repair", errors);
    must(engine, "vite.config.ts", "vite config repair", errors);
    must(engine, "index.html", "index.html repair", errors);
    must(engine, "src/main.tsx", "main.tsx repair", errors);
    must(engine, "vite build", "vite build script", errors);
    must(engine, "@vitejs/plugin-react", "vite react plugin dep", errors);
    return errors;
  },
  "failed-preview-ui-exact-reason": () => {
    const errors = [];
    const state = read("src/lib/preview/imported-preview-state.ts");
    const panel = read("src/components/create/workspace/preview-runtime-status-panel.tsx");
    const classifier = read("src/lib/preview/preview-failure-classifier.ts");
    must(state, "Preview build failed", "failed title in state", errors);
    must(state, "buildFailed", "failed before loading", errors);
    must(panel, "Preview build failed", "failed label in panel", errors);
    must(panel, "failure_kind", "failure kind display", errors);
    must(panel, "Copy technical details", "copy technical details CTA", errors);
    must(classifier, "missing tsconfig / path aliases", "alias failure category", errors);
    return errors;
  },
  "no-false-preview-loading-after-build-failed": () => {
    const errors = [];
    const panel = read("src/components/create/workspace/preview-panel.tsx");
    const state = read("src/lib/preview/imported-preview-state.ts");
    must(panel, "previewBuildFailed", "build failed guard in panel", errors);
    must(panel, "!previewBuildFailed", "slow load excludes failed", errors);
    must(state, "preview_loading", "loading state exists", errors);
    must(state, "buildFailed", "failed checked before loading", errors);
    must(panel, "!previewBuildFailed", "slow load hint excludes failed builds", errors);
    return errors;
  },
  "auto-rebuild-after-zip-repair": () => {
    const errors = [];
    const run = read("src/lib/imports/run-project-preview-build.ts");
    const queue = read("src/lib/imports/preview-build-queue.ts");
    must(run, "Auto-repair applied — rebuilding preview", "repair status message", errors);
    must(run, "runImportPreviewBuild", "auto queues build", errors);
    must(queue, "superseded_by", "supersede failed jobs", errors);
    must(read("src/app/api/projects/import-zip/route.ts"), "runProjectPreviewBuild", "import auto rebuild", errors);
    return errors;
  },
  "no-quality-debug-user-chat": () => {
    const errors = [];
    must(read("src/lib/build/user-build-copy-sanitizer.ts"), "sanitizeUserBuildChatText", "central sanitizer", errors);
    must(read("src/lib/build/workflow-stream-coalesce.ts"), "containsUserFacingBuildDebug", "coalesce uses sanitizer", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "sanitizeUserBuildChatText", "stream sanitizes", errors);
    mustNot(read("src/lib/build/live-build-activity.ts"), "Quality score:", "no quality in activity", errors);
    return errors;
  },
  "no-retry-debug-user-chat": () => {
    const errors = [];
    const sanitizer = read("src/lib/build/user-build-copy-sanitizer.ts");
    must(sanitizer, "retry", "retry pattern filter", errors);
    must(sanitizer, "continuation pass", "continuation pass filter", errors);
    must(sanitizer, "CONTINUE_GENERATION_LABEL", "continue generation label", errors);
    mustNot(read("src/lib/build/build-pipeline.ts"), "Retry ${continuationAttemptsTotal}", "no retry x/y in pipeline", errors);
    return errors;
  },
  "stale-build-reconciler": () => {
    const errors = [];
    const reconciler = read("src/lib/build/stale-build-reconciler.ts");
    must(reconciler, "reconcileStaleBuilds", "reconciler export", errors);
    must(reconciler, "stale_reason", "stale_reason metadata", errors);
    must(reconciler, "reconciled_at", "reconciled_at metadata", errors);
    must(reconciler, "waiting_for_worker", "queued waiting state", errors);
    if (!fs.existsSync(path.join(root, "scripts/reconcile-stale-builds.ts"))) {
      errors.push("reconcile CLI");
    }
    return errors;
  },
  "continue-generation-resumes-cleanly": () => {
    const errors = [];
    must(read("src/lib/build/build-pipeline.ts"), "resumeContinuation", "resume flag in pipeline", errors);
    must(read("src/components/create/workspace/immersive-workspace.tsx"), "resumeContinuation: true", "continue CTA resumes", errors);
    must(read("src/lib/build/build-continuation-state.ts"), "build_continuation", "continuation state", errors);
    must(read("src/lib/build/build-user-copy.ts"), "CONTINUE_GENERATION_LABEL", "continue label", errors);
    must(read("src/app/api/chat/route.ts"), "resumeContinuation", "api honors resume", errors);
    return errors;
  },
  "preview-worker-secret-injection": () => {
    const errors = [];
    const secrets = read("worker/preview-worker/src/project-secrets.ts");
    const runner = read("worker/preview-worker/src/job-runner.ts");
    must(secrets, "loadPreviewBuildEnv", "load secrets", errors);
    must(secrets, "VITE_", "VITE prefix allowlist", errors);
    must(secrets, "NEXT_PUBLIC_", "NEXT_PUBLIC allowlist", errors);
    must(secrets, "injectedNames", "track injected names", errors);
    mustNot(secrets, "console.log(value", "never log values", errors);
    must(runner, "injected_secret_names", "metadata records names", errors);
    must(runner, "loadPreviewBuildEnv", "runner loads secrets", errors);
    return errors;
  },
  "preview-no-raw-vodex-iframe": () => {
    const errors = [];
    const panel = read("src/components/create/workspace/preview-panel.tsx");
    const rewrite = read("src/lib/preview/rewrite-preview-artifact-html.ts");
    must(panel, "isBlockedRawAppPreviewUrl", "raw url blocked check", errors);
    must(panel, "artifact_proxy", "artifact proxy diagnostics", errors);
    must(rewrite, "vodex.dev", "vodex rewrite", errors);
    return errors;
  },
  "zip-spa-routing": () => {
    const errors = [];
    must(read("src/lib/preview/inject-preview-virtual-history.ts"), "__VODEX_PREVIEW_ACTIVE__", "virtual history", errors);
    must(read("src/lib/preview/inject-preview-virtual-history.ts"), "history.pushState", "spa routing shim", errors);
    must(read("src/lib/preview/rewrite-preview-artifact-html.ts"), "rewriteAbsoluteVodexLinksInHtml", "vodex link rewrite", errors);
    must(read("src/components/create/workspace/immersive-workspace.tsx"), "previewRoute,", "route in frame url", errors);
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
