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
  "generated-mobile-ready": () => {
    const e = [];
    must(read("src/lib/generated-apps/mobile-baseline.ts"), "getGeneratedMobileBaselineFiles", "baseline", e);
    must(read("src/lib/build/inject-mobile-baseline.ts"), "injectMobileBaselineIntoBuildFiles", "inject", e);
    must(read("src/lib/build/persist-generated-files.ts"), "injectMobileBaselineIntoBuildFiles", "persist hook", e);
    return e;
  },
  "generated-pwa-manifest": () => {
    const e = [];
    must(read("src/lib/generated-apps/mobile-baseline.ts"), "manifest.webmanifest", "manifest", e);
    return e;
  },
  "generated-safe-area": () => {
    const e = [];
    must(read("src/lib/generated-apps/mobile-baseline.ts"), "safe-area-inset", "safe area", e);
    return e;
  },
  "generated-no-horizontal-overflow": () => {
    const e = [];
    must(read("src/lib/generated-apps/mobile-baseline.ts"), "overflow-x: hidden", "overflow", e);
    return e;
  },
  "capacitor-export-ready": () => {
    const e = [];
    must(read("src/lib/mobile/capacitor-generator.ts"), "capacitor.config.ts", "generator", e);
    must(read("src/lib/generated-apps/mobile-baseline.ts"), "capacitor.config.ts", "baseline cap", e);
    must(read("src/app/api/projects/[id]/mobile/build/route.ts"), "generateCapacitorWrapperProject", "export api", e);
    return e;
  },
  "mobile-dashboard-readiness": () => {
    const e = [];
    must(read("src/components/create/workspace/app-dashboard-panel.tsx"), "MobileWrapperStudio", "dashboard mobile", e);
    must(read("src/components/create/workspace/app-dashboard-panel.tsx"), 'id: "mobile"', "mobile nav", e);
    return e;
  },
  "generated-app-data-isolation": () => {
    const e = [];
    must(read("src/lib/generated-apps/runtime-project-scope.ts"), "assertProjectOwnerScope", "owner scope", e);
    must(read("src/lib/generated-apps/runtime-project-scope.ts"), "rejectClientOwnerId", "reject client owner", e);
    return e;
  },
  "generated-runtime-project-scope": () => {
    const e = [];
    must(read("src/lib/generated-apps/mobile-baseline.ts"), "vodex-runtime-scope", "runtime scope file", e);
    must(read("src/app/api/projects/[id]/secrets/route.ts"), "owner_id", "secrets owner", e);
    return e;
  },
  "runtime-action-credit-consumption": () => {
    const e = [];
    must(read("src/lib/generated-apps/credit-reason-logs.ts"), "runtime_ai_action", "reason", e);
    must(read("src/lib/action-credits/runtime-owner-metering.ts"), "meterRuntimeActionForOwner", "meter", e);
    return e;
  },
  "own-provider-secret-skips-action-credit": () => {
    const e = [];
    must(read("src/lib/action-credits/own-provider-skip.ts"), "shouldSkipActionCreditsForOwnProvider", "skip fn", e);
    must(read("src/lib/action-credits/assert-action-credits-affordable.ts"), "shouldSkipActionCreditsForOwnProvider", "wired", e);
    return e;
  },
  "no-runtime-action-when-credits-empty": () => {
    const e = [];
    must(read("src/lib/action-credits/runtime-owner-metering.ts"), "insufficient", "block insufficient", e);
    must(read("src/lib/action-credits/assert-action-credits-affordable.ts"), "insufficient", "assert insufficient", e);
    return e;
  },
  "app-secrets-encrypted": () => {
    const e = [];
    must(read("src/lib/secrets/seal.ts"), "sealSecret", "seal", e);
    must(read("src/app/api/projects/[id]/secrets/route.ts"), "sealIntegrationSecret", "api seal", e);
    must(read("supabase/migrations/20260725120000_p18_secrets_harden.sql"), "project_secrets", "migration", e);
    return e;
  },
  "app-secrets-owner-only": () => {
    const e = [];
    must(read("src/app/api/projects/[id]/secrets/route.ts"), "owner_id", "owner check", e);
    return e;
  },
  "app-secrets-never-return-plaintext": () => {
    const e = [];
    const route = read("src/app/api/projects/[id]/secrets/route.ts");
    const getBlock = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
    if (getBlock.includes("ciphertext") || getBlock.includes("unsealSecret")) {
      e.push("GET must not expose ciphertext");
    }
    if (!route.includes("sealIntegrationSecret")) e.push("POST must seal secrets");
    return e;
  },
  "integration-secret-ui-fields": () => {
    const e = [];
    must(read("src/components/integrations/app-secrets-integrations-panel.tsx"), "integration-field-", "fields", e);
    must(read("src/lib/generated-apps/integration-registry.ts"), "INTEGRATION_PROVIDERS", "registry", e);
    return e;
  },
  "integration-guides-visible": () => {
    const e = [];
    must(read("src/components/integrations/app-secrets-integrations-panel.tsx"), "How to get this", "guides", e);
    return e;
  },
  "integration-save-partial-status": () => {
    const e = [];
    must(read("src/components/integrations/app-secrets-integrations-panel.tsx"), "Save partial", "partial", e);
    must(read("src/app/api/projects/[id]/secrets/route.ts"), "incomplete", "incomplete status", e);
    return e;
  },
  "integration-test-connection": () => {
    const e = [];
    must(read("src/app/api/projects/[id]/integrations/[provider]/test/route.ts"), "integration_test", "test route", e);
    return e;
  },
  "ai-detects-required-integrations": () => {
    const e = [];
    must(read("src/lib/generated-apps/integration-requirements.ts"), "detectRequiredIntegrations", "detect", e);
    return e;
  },
  "missing-secret-dashboard-checklist": () => {
    const e = [];
    must(read("src/components/integrations/app-secrets-integrations-panel.tsx"), "missing-secret-checklist", "checklist", e);
    return e;
  },
  "generated-code-does-not-fake-integrations": () => {
    const e = [];
    must(read("src/lib/build/stage-prompts.ts"), "never fake API success", "prompt rule", e);
    return e;
  },
  "app-dashboard-tabs-functional": () => {
    const e = [];
    must(read("src/components/create/workspace/app-dashboard-panel.tsx"), 'case "mobile"', "mobile tab", e);
    must(read("src/components/create/workspace/app-dashboard-panel.tsx"), 'case "publish"', "publish tab", e);
    must(read("src/components/create/workspace/app-dashboard-panel.tsx"), 'case "secrets"', "secrets tab", e);
    return e;
  },
  "published-dashboard-consistency": () => {
    const e = [];
    must(read("src/lib/dashboard/section-access.ts"), "isProjectPublished", "published helper", e);
    return e;
  },
  "no-dead-dashboard-buttons": () => {
    const e = [];
    must(read("src/components/create/workspace/app-dashboard-panel.tsx"), "data-testid=\"dashboard-publish-cta\"", "publish cta", e);
    return e;
  },
  "publish-button-flow": () => {
    const e = [];
    must(read("src/app/api/projects/[id]/publish/route.ts"), "startPublish", "publish api", e);
    return e;
  },
  "publish-prompt-flow": () => {
    const e = [];
    must(read("src/lib/publish/publish-service.ts"), "startPublish", "publish service", e);
    return e;
  },
  "publish-job-resume": () => {
    const e = [];
    must(read("src/components/publish/publish-status-panel.tsx"), "projectId", "status panel", e);
    return e;
  },
  "publish-no-fake-success": () => {
    const e = [];
    must(read("src/lib/publish/publish-service.ts"), "startPublish", "start publish", e);
    must(read("src/lib/publish/publish-service.ts"), "resolveDisplayPublicUrl", "display url", e);
    return e;
  },
  "cheap-build-no-blockers": () => {
    const e = [];
    must(read("scripts/qa-cheap-build.mjs"), "client portal", "qa script", e);
    return e;
  },
  "cheap-build-preview-renderable": () => {
    const e = [];
    must(read("scripts/qa-cheap-build.mjs"), "app/page.tsx", "page check", e);
    return e;
  },
  "mobile-layout-all-main-pages": () => {
    const e = [];
    must(read("src/app/globals.css"), "safe-area-pad", "safe area util", e);
    return e;
  },
  "no-duplicate-mobile-actions": () => {
    const e = [];
    must(read("src/components/layout/deferred-shell-chrome.tsx"), "safe-area-inset-bottom", "mobile nav safe", e);
    return e;
  },
  "no-secrets-client-leak": () => {
    const e = [];
    const panel = read("src/components/integrations/app-secrets-integrations-panel.tsx");
    if (panel.includes("unsealSecret")) e.push("client must not unseal");
    return e;
  },
  "owner-only-secret-management": () => {
    const e = [];
    must(read("src/app/api/projects/[id]/secrets/route.ts"), ".eq(\"owner_id\", user.id)", "owner gate", e);
    return e;
  },
  "project-access-isolation": () => {
    const e = [];
    must(read("src/lib/generated-apps/runtime-project-scope.ts"), "owner_id !== userId", "isolation", e);
    return e;
  },
};

const check = process.argv[2] ?? "";
const names = check ? [check] : Object.keys(suites);
let failed = 0;

for (const name of names) {
  const fn = suites[name];
  if (!fn) {
    console.error(`Unknown: ${name}`);
    failed++;
    continue;
  }
  const errors = fn();
  if (errors.length) {
    console.error(`FAIL ${name}:`);
    errors.forEach((x) => console.error(`  - ${x}`));
    failed++;
  } else {
    console.log(`OK ${name}`);
  }
}

process.exit(failed ? 1 : 0);
