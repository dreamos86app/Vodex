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
  "dashboard-nav-rebuild": () => {
    const errors = [];
    const nav = read("src/components/dashboard/dashboard-section-nav.tsx");
    const panel = read("src/components/create/workspace/app-dashboard-panel.tsx");
    must(read("src/lib/dashboard/dashboard-nav.ts"), "DASHBOARD_NAV", "dashboard nav config", errors);
    must(panel, "DashboardSectionNav", "wired section nav", errors);
    must(nav, "overflow-x-auto", "mobile horizontal tabs", errors);
    mustNot(nav, "setSheetOpen", "no dropdown sheet", errors);
    must(nav, "storeDashboardSection", "persists selection", errors);
    mustNot(panel, "MAIN_NAV", "old 16-item nav removed", errors);
    return errors;
  },
  "community-listing-moved": () => {
    const errors = [];
    const form = read("src/components/create/workspace/app-settings-inline-form.tsx");
    const publish = read("src/components/settings/publish-visibility-settings.tsx");
    const panel = read("src/components/create/workspace/app-dashboard-panel.tsx");
    mustNot(form, "List in community", "removed from app details", errors);
    must(publish, "publish-visibility-settings", "visibility panel", errors);
    must(panel, "PublishVisibilitySettings", "wired under publish", errors);
    return errors;
  },
  "auth-center-rebuild": () => {
    const errors = [];
    must(read("src/components/settings/app-auth-center.tsx"), "app-auth-center", "auth center", errors);
    must(read("src/components/settings/auth-provider-card.tsx"), "Configure", "provider cards", errors);
    must(read("src/components/settings/custom-oauth-wizard.tsx"), "custom-oauth-wizard", "oauth wizard", errors);
    must(read("src/components/settings/auth-fallback-panel.tsx"), "auth-fallback-panel", "fallback panel", errors);
    must(read("src/components/create/workspace/app-dashboard-panel.tsx"), "AppAuthCenter", "auth section wired", errors);
    return errors;
  },
  "app-template-page": () => {
    const errors = [];
    must(read("src/components/templates/app-template-settings-panel.tsx"), "app-template-settings", "template panel", errors);
    must(read("src/components/create/workspace/app-dashboard-panel.tsx"), "AppTemplateSettingsPanel", "template wired", errors);
    return errors;
  },
  "deploy-center-mobile": () => {
    const errors = [];
    const deploy = read("src/components/deploy/deploy-view.tsx");
    must(deploy, "deploy-section-tabs", "section tabs", errors);
    must(deploy, "DeploymentCard", "deployment cards", errors);
    must(deploy, "overflow-x-hidden", "no horizontal page scroll", errors);
    must(deploy, "vertical", "mobile vertical cards", errors);
    return errors;
  },
  "builder-mobile-layout": () => {
    const errors = [];
    const panel = read("src/components/create/workspace/app-dashboard-panel.tsx");
    const immersive = read("src/components/create/workspace/immersive-workspace.tsx");
    const standalone = read("src/components/apps/app-project-dashboard.tsx");
    must(panel, "overflow-x-hidden", "dashboard no overflow", errors);
    must(panel, "flex-col", "mobile column layout", errors);
    must(immersive, "h-full min-h-0", "dashboard height chain", errors);
    mustNot(standalone, "max-h-[min(70vh,720px)]", "scroll trap removed", errors);
    return errors;
  },
};

const names = check ? [check] : Object.keys(suites);
let failed = 0;
for (const name of names) {
  const fn = suites[name];
  if (!fn) {
    console.error(`Unknown suite: ${name}`);
    failed++;
    continue;
  }
  const errors = fn();
  if (errors.length) {
    console.error(`FAIL ${name}`);
    for (const e of errors) console.error(`  - ${e}`);
    failed++;
  } else {
    console.log(`OK ${name}`);
  }
}
process.exit(failed ? 1 : 0);
