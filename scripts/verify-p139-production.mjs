#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv[2] ?? "";

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
  "build-state-truth": () => {
    const errors = [];
    must(read("src/lib/build/build-state-truth.ts"), "build_failed_no_files", "canonical states", errors);
    must(read("src/lib/build/build-terminal-truth.ts"), "resolveBuildTerminalTruth", "P1.3.11 terminal truth", errors);
    must(read("src/lib/build/workflow-status-guards.ts"), "resolveCanonicalBuildState", "wired to guards", errors);
    must(read("src/lib/build/workflow-status-guards.ts"), "resolveBuildTerminalTruth", "guards use terminal truth", errors);
    must(read("src/components/create/workspace/build-run-summary.tsx"), "resolveBuildTerminalTruth", "summary guard", errors);
    mustNot(read("src/lib/build/workflow-status-guards.ts"), "Draft saved — additional generation needed", "no draft saved copy", errors);
    return errors;
  },
  "preview-state-truth": () => {
    const errors = [];
    must(read("src/lib/preview/imported-preview-state.ts"), "Preview needs to be prepared", "imported prepare default", errors);
    must(read("src/lib/preview/imported-preview-state.ts"), "showScaryBlocked: false", "no scary default", errors);
    return errors;
  },
  "preview-blocked-not-default": () => {
    const errors = [];
    const imported = read("src/lib/preview/imported-preview-state.ts");
    must(imported, "Preview needs to be prepared", "prepare default title", errors);
    must(imported, "showScaryBlocked: false", "no scary blocked flag on import path", errors);
    return errors;
  },
  "preview-fit": () => {
    const errors = [];
    must(read("src/components/create/workspace/preview-panel.tsx"), "data-testid=\"preview-fit-canvas\"", "fit canvas", errors);
    must(read("src/components/create/workspace/preview-panel.tsx"), "h-[calc(100%-12px)]", "desktop framed height", errors);
    must(read("src/components/create/workspace/preview-panel.tsx"), "w-[min(100%,102%)]", "desktop slight width expansion", errors);
    return errors;
  },
  "live-diff-counts": () => {
    const errors = [];
    must(read("src/lib/build/build-pipeline.ts"), "+${fileLineMeta.added_lines}", "pipeline line counts", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "workflow-file-diff-summary", "diff summary", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "AnimatedLineDelta", "line delta ui", errors);
    return errors;
  },
  "user-facing-description": () => {
    const errors = [];
    must(read("src/lib/projects/derive-user-facing-description.ts"), "deriveUserFacingAppDescription", "derive fn", errors);
    must(read("src/lib/projects/app-name-generator.ts"), "sanitizeStoredDescription", "generator sanitize", errors);
    must(read("src/lib/build/build-state-truth.ts"), "isInternalBuildPlanText", "plan leak guard", errors);
    return errors;
  },
  "publish-readiness-separation": () => {
    const errors = [];
    must(read("src/lib/publish/publish-readiness-separation.ts"), "filterWebPublishBlockers", "web filter", errors);
    must(read("src/components/create/workspace/publish-modal.tsx"), "Mobile packaging (does not block web)", "modal separation", errors);
    must(read("src/components/create/workspace/publish-modal.tsx"), "filterWebPublishBlockers", "modal uses filter", errors);
    return errors;
  },
  "overlay-z-index": () => {
    const errors = [];
    must(read("src/app/globals.css"), "--z-dialog", "dialog token", errors);
    must(read("src/app/globals.css"), "--z-confirmation", "confirmation token", errors);
    must(read("src/components/ui/toaster.tsx"), "overlayZClass(\"toast\")", "toast layer", errors);
    must(read("src/components/create/workspace/publish-modal.tsx"), "var(--z-modal-backdrop)", "modal layer", errors);
    must(read("src/components/ui/overlay-layers.ts"), "overlayZClass", "overlay layer helper", errors);
    return errors;
  },
  "builder-section-navigation": () => {
    const errors = [];
    must(read("src/lib/navigation/builder-section-navigation.ts"), "navigateBuilderSection", "nav helper", errors);
    must(read("src/components/create/workspace/immersive-workspace.tsx"), "BUILDER_SECTION_NAV_EVENT", "nav listener", errors);
    return errors;
  },
  "auth-page-redesign": () => {
    const errors = [];
    must(read("src/components/settings/app-auth-center.tsx"), "auth-provider-row-email", "email row", errors);
    must(read("src/components/settings/app-auth-center.tsx"), "Gmail / Email", "gmail first", errors);
    must(read("src/components/settings/app-auth-center.tsx"), "Phone number", "phone visible", errors);
    must(read("src/components/settings/app-auth-center.tsx"), "Custom OAuth", "custom oauth row", errors);
    mustNot(read("src/components/settings/app-auth-center.tsx"), "Show advanced auth settings", "no advanced toggle", errors);
    return errors;
  },
  "version-history-entrypoint": () => {
    const errors = [];
    must(read("src/components/builder/version-history-drawer.tsx"), "version-history-entrypoint", "entry button", errors);
    must(read("src/components/create/workspace/immersive-workspace.tsx"), "VersionHistoryDrawer", "drawer wired", errors);
    return errors;
  },
  "mobile-setup-loading": () => {
    const errors = [];
    must(read("src/components/mobile/mobile-wrapper-studio.tsx"), "mobile-setup-skeleton", "skeleton", errors);
    must(read("src/components/mobile/mobile-wrapper-studio.tsx"), "Still loading mobile setup", "slow load copy", errors);
    return errors;
  },
  "apps-card-menu": () => {
    const errors = [];
    must(read("src/components/apps/project-card-overflow-menu.tsx"), "project-card-overflow-menu", "menu component", errors);
    must(read("src/components/apps/project-card-overflow-menu.tsx"), "FloatingMenu", "portal floating menu", errors);
    must(read("src/components/apps/projects-view.tsx"), "ProjectCardOverflowMenu", "menu wired", errors);
    return errors;
  },
  "watermark-footer": () => {
    const errors = [];
    mustNot(read("src/components/dashboard/app-settings-dashboard-panel.tsx"), 'title="Branding"', "branding removed", errors);
    must(read("src/lib/publish/watermark-runtime.ts"), "Made with Vodex", "footer text", errors);
    mustNot(read("src/lib/publish/watermark-runtime.ts"), "vodex-promo-chip", "no promo chip", errors);
    return errors;
  },
  "overview-preview-thumbnail": () => {
    const errors = [];
    must(read("src/components/dashboard/overview-preview-thumbnail-control.tsx"), "overview-preview-thumbnail-control", "thumbnail control", errors);
    must(read("src/components/dashboard/overview-dashboard-panel.tsx"), "OverviewPreviewThumbnailControl", "overview wired", errors);
    return errors;
  },
  "clickable-affordances": () => {
    const errors = [];
    must(read("src/components/settings/auth-provider-row.tsx"), "cursor-pointer", "auth row pointer", errors);
    must(read("src/components/apps/project-card-overflow-menu.tsx"), "cursor-pointer", "menu pointer", errors);
    return errors;
  },
  "zip-import-production-flow": () => {
    const errors = [];
    must(read("src/lib/publish/publish-readiness-separation.ts"), "deferred", "mobile deferred", errors);
    const zip = read("src/app/api/projects/import-zip/route.ts");
    must(zip, "import-zip", "zip import route", errors);
    return errors;
  },
  "generated-preview-autostart": () => {
    const errors = [];
    must(read("src/lib/build/execute-staged-build-job.ts"), "startPreviewSession", "preview autostart", errors);
    return errors;
  },
};

function runAll() {
  let failed = 0;
  for (const [name, fn] of Object.entries(suites)) {
    const errors = fn();
    if (errors.length) {
      failed += 1;
      console.error(`\n✗ ${name}`);
      errors.forEach((e) => console.error(`  - ${e}`));
    } else {
      console.log(`✓ ${name}`);
    }
  }
  if (failed) process.exit(1);
  console.log("\nAll P1.3.9 verification suites passed.");
}

if (!check) runAll();
else if (suites[check]) {
  const errors = suites[check]();
  if (errors.length) {
    errors.forEach((e) => console.error(e));
    process.exit(1);
  }
  console.log(`✓ ${check}`);
} else {
  console.error(`Unknown suite: ${check}`);
  process.exit(1);
}
