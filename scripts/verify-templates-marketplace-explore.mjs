#!/usr/bin/env node
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
  "templates-official-six-only": () => {
    const errors = [];
    const official = read("src/lib/templates/official-templates.ts");
    must(official, "OFFICIAL_TEMPLATE_IDS", "official ids", errors);
    for (const id of [
      "ai-saas-starter",
      "mobile-twa-play-store",
      "analytics-dashboard",
      "marketplace-starter",
      "community-platform",
      "landing-waitlist",
    ]) {
      must(official, `"${id}"`, `id ${id}`, errors);
    }
    must(read("src/lib/data.ts"), "OFFICIAL_TEMPLATES as templates", "data re-export", errors);
    const view = read("src/components/templates/templates-view.tsx");
    must(view, "getTemplateSourceFiles", "source filter", errors);
    must(view, "OFFICIAL_TEMPLATES", "official list", errors);
    must(view, "template-preview-image", "preview image", errors);
    if (view.includes("TemplateMockup")) errors.push("must not use TemplateMockup on official cards");
    return errors;
  },
  "template-duplicate-source-project": () => {
    const errors = [];
    must(read("src/lib/templates/duplicate-template-to-project.ts"), "getTemplateSourceFiles", "source files", errors);
    must(read("src/lib/templates/duplicate-template-to-project.ts"), "app_files", "app_files", errors);
    must(read("src/lib/templates/duplicate-template-to-project.ts"), "skip_identity_generation", "no ai identity", errors);
    must(read("src/lib/templates/duplicate-community-template.ts"), "template_files", "community files", errors);
    must(read("src/lib/templates/duplicate-community-template.ts"), "template_usage_events", "usage events", errors);
    must(read("src/app/api/templates/[id]/use/route.ts"), "duplicateCommunityTemplateToProject", "community use", errors);
    return errors;
  },
  "community-template-publish-pro-only": () => {
    const errors = [];
    must(read("src/app/api/templates/publish/route.ts"), "isPaidPlan", "pro gate", errors);
    must(read("src/lib/templates/template-publish.ts"), "template_files", "snapshot files", errors);
    must(read("src/components/templates/publish-template-modal.tsx"), "publish-template-modal", "modal", errors);
    must(read("src/components/create/workspace/app-dashboard-panel.tsx"), "publish-as-template-button", "dashboard btn", errors);
    return errors;
  },
  "template-like-system": () => {
    const errors = [];
    must(read("src/app/api/templates/[id]/like/route.ts"), "template_likes", "likes table", errors);
    must(read("src/components/templates/templates-view.tsx"), "template-like-button", "like ui", errors);
    must(read("src/components/templates/templates-view.tsx"), "fill-sky-500", "filled like", errors);
    must(read("supabase/migrations/20260726120000_template_catalog_harden.sql"), "template_likes", "migration likes", errors);
    return errors;
  },
  "template-usage-count": () => {
    const errors = [];
    must(read("supabase/migrations/20260726120000_template_catalog_harden.sql"), "template_usage_events", "usage migration", errors);
    must(read("supabase/migrations/20260726120000_template_catalog_harden.sql"), "sync_template_use_count", "use trigger", errors);
    must(read("src/components/templates/templates-view.tsx"), "useCount", "use count ui", errors);
    return errors;
  },
  "marketplace-coming-soon": () => {
    const errors = [];
    const mkt = read("src/components/marketplace/marketplace-coming-soon-view.tsx");
    must(mkt, "marketplace-coming-soon", "testid", errors);
    must(mkt, "Coming soon", "coming soon", errors);
    must(mkt, "extensions", "extensions copy", errors);
    if (mkt.includes("View source")) errors.push("must not have View source");
    const legacy = read("src/components/marketplace/marketplace-view.tsx");
    if (legacy.includes("OFFICIAL_TEMPLATES")) errors.push("marketplace must not list templates");
    if (legacy.includes("TemplateMockup")) errors.push("marketplace must not use template mockups");
    return errors;
  },
  "explore-not-duplicating-templates": () => {
    const errors = [];
    const explore = read("src/components/explore/explore-view.tsx");
    must(explore, "explore-view", "testid", errors);
    must(explore, "explore-ideas-section", "ideas section", errors);
    must(explore, "explore-public-app-card", "public apps", errors);
    if (explore.includes("/marketplace?template=")) errors.push("explore must not link marketplace templates");
    if (explore.includes("OFFICIAL TEMPLATES")) errors.push("explore must not duplicate templates grid");
    if (explore.includes("templates-tab-switcher")) errors.push("explore must not use templates UI");
    must(explore, "/templates", "link to templates", errors);
    return errors;
  },
};

const only = process.argv[2];
const run = only && suites[only] ? { [only]: suites[only] } : suites;

let failed = false;
for (const [name, fn] of Object.entries(run)) {
  console.log(`\n=== verify:${name} ===\n`);
  const errors = fn();
  if (errors.length) {
    failed = true;
    errors.forEach((e) => console.error("✗", e));
  } else {
    console.log("✓ OK");
  }
}

if (failed) process.exit(1);
