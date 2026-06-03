#!/usr/bin/env node
/**
 * VODEX P2 production verification — static architecture checks.
 * Run all: node scripts/verify-p2-production.mjs
 * Run one: node scripts/verify-p2-production.mjs one-click-github-connect
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

function exists(rel, errors) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
}

const suites = {
  "one-click-github-connect": () => {
    const errors = [];
    exists("src/app/api/integrations/github/user/oauth/start/route.ts", errors);
    exists("src/app/api/projects/[id]/integrations/github/quick-connect/route.ts", errors);
    const cb = read("src/app/api/integrations/github/callback/route.ts");
    must(cb, 'mode === "user"', "user oauth state", errors);
    must(cb, "saveUserProviderConnection", "persist user link", errors);
    must(read("src/lib/integrations/server/user-provider-connections.ts"), "sealIntegrationSecret", "encrypt token", errors);
    return errors;
  },
  "one-click-supabase-connect": () => {
    const errors = [];
    exists("src/app/api/integrations/supabase/user/link/route.ts", errors);
    exists("src/app/api/projects/[id]/integrations/supabase/quick-connect/route.ts", errors);
    exists("src/lib/integrations/server/supabase-management-api.ts", errors);
    const qc = read("src/app/api/projects/[id]/integrations/supabase/quick-connect/route.ts");
    must(qc, "saveProjectSecret", "secrets server-side", errors);
    must(read("src/components/integrations/integrations-catalog-panel.tsx"), "Select Supabase project", "project picker", errors);
    return errors;
  },
  "integrations-pro-lock": () => {
    const errors = [];
    const panel = read("src/components/integrations/integrations-catalog-panel.tsx");
    must(panel, "integrations-pro-lock", "pro lock testid", errors);
    must(panel, "vodex-upgrade-cta", "upgrade cta", errors);
    must(panel, "canUseIntegrations", "plan gate", errors);
    must(read("src/lib/integrations/integrations-catalog.ts"), "INTEGRATION_CATEGORIES", "categories", errors);
    must(panel, "INTEGRATION_CATEGORIES", "grouped UI", errors);
    return errors;
  },
  "secrets-page-clean": () => {
    const errors = [];
    const dash = read("src/components/create/workspace/app-dashboard-panel.tsx");
    must(dash, "AppProjectSecretsPanel", "secrets panel", errors);
    must(dash, "IntegrationsCatalogPanel", "integrations panel", errors);
    if (dash.includes("AppSecretsIntegrationsPanel")) {
      errors.push("no combined panel in dashboard");
    }
    const secrets = read("src/components/integrations/app-project-secrets-panel.tsx");
    must(secrets, "guideForKey", "secret guides", errors);
    must(secrets, "never shown again", "no reveal copy", errors);
    must(read("src/lib/secrets/seal.ts"), "APP_SECRET_ENCRYPTION_KEY", "encryption key", errors);
    return errors;
  },
  "workspace-owner-billing": () => {
    const errors = [];
    const billing = read("src/lib/billing/workspace-credit-billing.ts");
    must(billing, "project.owner_id !== actorUserId", "collaborator bills owner", errors);
    must(billing, "billedUserId: project.owner_id", "charge owner account", errors);
    must(read("src/components/layout/quick-collaborator-popover.tsx"), "Usage is billed to this workspace", "billing note", errors);
    return errors;
  },
  "quick-collaborator-ui": () => {
    const errors = [];
    must(read("src/components/layout/top-bar.tsx"), "QuickCollaboratorPopover", "top bar popover", errors);
    must(read("src/components/layout/quick-collaborator-popover.tsx"), "quick-collaborator-popover", "testid", errors);
    must(read("src/components/layout/quick-collaborator-popover.tsx"), "editor", "roles", errors);
    return errors;
  },
  "overview-app-editing": () => {
    const errors = [];
    const dash = read("src/components/create/workspace/app-dashboard-panel.tsx");
    must(dash, "AppSettingsInlineForm", "overview form", errors);
    must(dash, "overview-app-editing", "testid", errors);
    const form = read("src/components/create/workspace/app-settings-inline-form.tsx");
    must(form, "upload-app-logo", "logo upload", errors);
    must(form, "generate-app-logo", "logo generate", errors);
    exists("src/app/api/upload/project-icon/route.ts", errors);
    return errors;
  },
  "logo-sync-everywhere": () => {
    const errors = [];
    must(read("src/components/create/workspace/app-settings-inline-form.tsx"), "notifyProjectCatalogUpdated", "catalog sync", errors);
    must(read("src/app/api/upload/project-icon/route.ts"), "notifyProjectCatalogUpdated", "upload sync", errors);
    must(read("src/lib/projects/project-catalog-sync.ts"), "notifyProjectCatalogUpdated", "sync helper", errors);
    return errors;
  },
  "upgrade-button-polish": () => {
    const errors = [];
    const css = read("src/app/globals.css");
    must(css, ".vodex-upgrade-cta", "upgrade class", errors);
    must(css, "prefers-reduced-motion", "a11y motion", errors);
    must(read("src/components/billing/build-credits-upgrade-panel.tsx"), "vodex-upgrade-cta", "credits panel cta", errors);
    must(read("src/components/chat/credits-upgrade-modal.tsx"), "vodex-upgrade-cta", "modal cta", errors);
    return errors;
  },
  "out-of-credits-card": () => {
    const errors = [];
    const panel = read("src/components/billing/build-credits-upgrade-panel.tsx");
    must(panel, "max-w-none", "full width", errors);
    must(panel, "build-credits-upgrade-perks", "perks list", errors);
    must(read("src/lib/billing/build-credits-upgrade.ts"), "and more…", "7th perk", errors);
    must(panel, "Upgrade to Starter —", "dynamic cta label", errors);
    return errors;
  },
  "publish-readiness-integrations": () => {
    const errors = [];
    exists("src/lib/publish/integration-secret-readiness.ts", errors);
    exists("src/components/publish/publish-setup-checklist.tsx", errors);
    must(read("src/app/api/projects/[id]/publish/readiness/route.ts"), "collectPublishSetupGaps", "readiness gaps", errors);
    must(read("src/components/create/workspace/app-dashboard-panel.tsx"), "PublishSetupChecklist", "checklist UI", errors);
    must(read("src/components/publish/publish-setup-checklist.tsx"), "publish-integrations-checklist", "testid", errors);
    return errors;
  },
  "cheap-generation-e2e": () => {
    const errors = [];
    exists("src/app/api/chat/route.ts", errors);
    exists("src/app/api/projects/[id]/publish/readiness/route.ts", errors);
    exists("src/components/create/workspace/immersive-workspace.tsx", errors);
    must(read("package.json"), "verify:preview-state-machine", "preview verify wired", errors);
    must(read("package.json"), "verify:credit-accounting-build-icon", "credit verify wired", errors);
    must(read("src/lib/billing/credit-reservations.ts"), "resolveCreditBillingTarget", "credit reservations", errors);
    return errors;
  },
};

const check = process.argv[2] ?? "";
const names = check ? [check] : Object.keys(suites);
let failed = 0;
for (const name of names) {
  const errors = suites[name]?.() ?? [`unknown suite ${name}`];
  console.log(`\n=== verify:${name} ===\n`);
  if (errors.length) {
    failed += 1;
    for (const e of errors) console.log(`✗ ${e}`);
  } else {
    console.log("✓ OK");
  }
}
process.exit(failed ? 1 : 0);
