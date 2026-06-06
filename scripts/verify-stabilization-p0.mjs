#!/usr/bin/env node
/**
 * P0/P1 stabilization verification — builder truth, drafts, preview, publish, mobile nav.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));

const suites = {
  "builder-state": () => {
    const errors = [];
    if (!exists("src/lib/build/canonical-build-state.ts")) errors.push("canonical-build-state missing");
    const canon = read("src/lib/build/canonical-build-state.ts");
    if (!canon.includes("computeCanonicalBuildState")) errors.push("computeCanonicalBuildState missing");
    const exec = read("src/lib/build/execute-staged-build-job.ts");
    if (!exec.includes("source_integrity_passed")) errors.push("source_integrity_passed stage missing");
    const complete = read("src/lib/build/complete-build-with-validation.ts");
    if (complete.includes("preview_ready: false") && !complete.includes("previewWasReady")) {
      errors.push("completeBuildWithValidation clobbers preview without guard");
    }
    const status = read("src/app/api/projects/[id]/status/route.ts");
    if (!status.includes("computeCanonicalBuildState")) errors.push("status API missing canonical state");
    return errors;
  },
  "preview-state": () => {
    const errors = [];
    if (!exists("src/components/preview/preview-failure-diagnostics-panel.tsx")) {
      errors.push("preview-failure-diagnostics-panel missing");
    }
    const panel = read("src/components/preview/preview-failure-diagnostics-panel.tsx");
    if (!panel.includes("preview-failure-diagnostics")) errors.push("preview diagnostics testid missing");
    const trace = read("src/lib/build/build-worker-trace.ts");
    if (trace.includes('persist_completed: "Files saved"')) {
      errors.push('persist_completed must not claim "Files saved" before integrity');
    }
    return errors;
  },
  "publish-state": () => {
    const errors = [];
    if (!exists("src/components/publish/publish-readiness-cards.tsx")) errors.push("publish-readiness-cards missing");
    const modal = read("src/components/create/workspace/publish-modal.tsx");
    if (!modal.includes("PublishReadinessCards")) errors.push("publish modal missing readiness cards");
    if (!modal.includes("publish-modal-body")) errors.push("publish modal scroll body missing");
    return errors;
  },
  "draft-persistence": () => {
    const errors = [];
    const create = read("src/lib/projects/create-project-from-prompt.ts");
    if (create.includes("hide_from_home_main: true")) errors.push("new drafts still hidden from home");
    const visible = read("src/lib/projects/user-visible-projects.ts");
    if (visible.includes("hide_from_home_main === true")) errors.push("hide_from_home_main still filters lists");
    const home = read("src/app/api/home/recent-projects/route.ts");
    if (!home.includes("sections:")) errors.push("home API missing categorized sections");
    if (!exists("src/components/os-home/building-section.tsx")) errors.push("building-section missing");
    return errors;
  },
  "mobile-layouts": () => {
    const errors = [];
    const dash = read("src/components/create/workspace/app-dashboard-panel.tsx");
    if (dash.includes('<select') && dash.includes("Dashboard section")) {
      errors.push("dashboard still uses dropdown on mobile");
    }
    if (!dash.includes("dashboard-mobile-tabs")) errors.push("dashboard mobile tabs missing");
    const projects = read("src/components/apps/projects-view.tsx");
    if (!projects.includes("overflow-x-hidden")) errors.push("projects view overflow guard missing");
    const settings = read("src/app/(app)/settings/settings-shell.tsx");
    if (!settings.includes("settings-tabs-scroll")) errors.push("settings mobile scroll tabs missing");
    return errors;
  },
  "authentication-flows": () => {
    const errors = [];
    const auth = read("src/components/settings/app-auth-settings-panel.tsx");
    if (!auth.includes("google_enabled")) errors.push("app auth settings panel incomplete");
    if (!exists("src/lib/projects/user-facing-description.ts")) errors.push("user-facing-description missing");
    const presence = read("src/components/settings/presence-settings-section.tsx");
    if (presence.includes("Appear offline")) errors.push("presence still has Appear offline");
    return errors;
  },
};

const target = process.argv[2] ?? "all";
const run = target === "all" ? Object.keys(suites) : [target];
const allErrors = [];

for (const name of run) {
  const fn = suites[name];
  if (!fn) {
    console.error(`Unknown suite: ${name}`);
    process.exit(1);
  }
  const errors = fn();
  if (errors.length) {
    console.error(`\n✗ verify:${name}`);
    errors.forEach((e) => console.error("  -", e));
    allErrors.push(...errors);
  } else {
    console.log(`✓ verify:${name}`);
  }
}

process.exit(allErrors.length ? 1 : 0);
