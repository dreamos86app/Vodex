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
  "zip-route-discovery": () => {
    const errors = [];
    must(read("src/lib/preview/route-discovery.ts"), "discoverImportedAppRoutes", "route discovery", errors);
    must(read("src/lib/preview/imported-app-route-manifest.ts"), "buildImportedRouteManifest", "manifest persist", errors);
    return errors;
  },
  "zip-spa-routing": () => {
    const errors = [];
    must(read("src/lib/preview/inject-preview-router-shim.ts"), "replaceState", "router shim", errors);
    must(read("src/lib/preview/inject-preview-router-shim.ts"), "PopStateEvent", "router popstate", errors);
    must(read("src/lib/preview/rewrite-preview-artifact-html.ts"), "injectPreviewRouterShim", "artifact rewrite", errors);
    must(read("src/lib/preview/rewrite-preview-artifact-html.ts"), "injectPreviewNavigationGuard", "nav guard", errors);
    must(read("src/app/api/projects/[id]/preview-assets/[...path]/route.ts"), "index.html", "spa fallback", errors);
    must(read("src/components/create/workspace/immersive-workspace.tsx"), "previewRoute,", "route in frame url", errors);
    return errors;
  },
  "preview-no-raw-vodex-iframe": () => {
    const errors = [];
    must(read("src/lib/preview/rewrite-preview-artifact-html.ts"), "isBlockedRawAppPreviewUrl", "block raw vodex", errors);
    must(read("src/lib/preview/inject-preview-navigation-guard.ts"), "vodex", "nav guard script", errors);
    must(read("src/components/create/workspace/preview-panel.tsx"), "raw_blocked", "raw blocked diagnostics", errors);
    must(read("src/components/create/workspace/preview-panel.tsx"), "preview-diagnostics", "diagnostics strip", errors);
    return errors;
  },
  "public-deep-routes": () => {
    const errors = [];
    must(read("src/app/p/[slug]/[[...path]]/route.ts"), "normalizePublishedRoute", "public deep routes", errors);
    must(read("src/lib/publish/rewrite-published-artifact-html.ts"), "injectPreviewRouterShim", "published spa", errors);
    return errors;
  },
  "secrets-ai-assistant-flow": () => {
    const errors = [];
    must(read("src/components/import/imported-secrets-setup-panel.tsx"), "autostart=1", "autostart link", errors);
    must(read("src/components/create/workspace/immersive-workspace.tsx"), "pendingInsertAutoSubmit", "auto submit", errors);
    must(read("src/components/create/workspace/immersive-workspace.tsx"), 'setMode("discuss")', "discuss mode on insert", errors);
    must(read("src/components/create/workspace/immersive-workspace.tsx"), "secretsChatPanelOpen", "secrets chat panel state", errors);
    must(read("src/components/import/imported-secrets-setup-panel.tsx"), "Help me connect the required secrets", "secrets prompt", errors);
    must(read("src/components/import/imported-secrets-setup-panel.tsx"), "onAskAi", "ask ai callback", errors);
    return errors;
  },
  "secret-setup-panel": () => {
    const errors = [];
    must(read("src/components/chat/secret-setup-panel.tsx"), "secret-setup-panel", "panel test id", errors);
    must(read("src/components/chat/secret-setup-panel.tsx"), "ImportedSecretsSetupPanel", "reuses secrets form", errors);
    must(read("src/components/create/workspace/immersive-workspace.tsx"), "SecretSetupPanel", "chat panel wired", errors);
    return errors;
  },
  "payments-provider-icons": () => {
    const errors = [];
    must(read("src/components/payments/project-payments-panel.tsx"), "IntegrationIconWell", "payment icons", errors);
    must(read("src/components/payments/project-payments-panel.tsx"), "cursor-pointer", "clickable cards", errors);
    must(read("src/components/brand/integration-icons.tsx"), "revenuecat", "revenuecat icon", errors);
    mustNot(read("src/components/payments/project-payments-panel.tsx"), ">RC<", "no RC initials", errors);
    return errors;
  },
  "payments-provider-capabilities": () => {
    const errors = [];
    must(read("src/lib/integrations/provider-capabilities.ts"), "PAYMENT_PROVIDER_CAPABILITIES", "payment caps", errors);
    must(read("src/lib/integrations/provider-capabilities.ts"), "IntegrationConnectionMode", "connection mode type", errors);
    must(read("src/components/payments/project-payments-panel.tsx"), "connectionModeLabel", "mode badge", errors);
    return errors;
  },
  "auth-provider-icons": () => {
    const errors = [];
    must(read("src/components/brand/auth-provider-icons.tsx"), "siGoogle", "google icon", errors);
    must(read("src/components/settings/app-auth-center.tsx"), "AuthProviderIcon", "auth center icons", errors);
    return errors;
  },
  "auth-provider-capabilities": () => {
    const errors = [];
    must(read("src/lib/integrations/provider-capabilities.ts"), "AUTH_PROVIDER_CAPABILITIES", "auth caps", errors);
    must(read("src/components/settings/app-auth-center.tsx"), "coming_soon", "honest coming soon", errors);
    must(read("src/components/settings/app-auth-center.tsx"), "Setup required", "setup required badge", errors);
    return errors;
  },
  "analytics-ranges": () => {
    const errors = [];
    must(read("src/app/api/projects/[id]/analytics/route.ts"), "fillTimeBuckets", "bucket fill", errors);
    must(read("src/app/api/projects/[id]/analytics/route.ts"), 'period === "24h"', "24h buckets", errors);
    return errors;
  },
  "analytics-mini-graphs": () => {
    const errors = [];
    must(read("src/components/dashboard/dashboard-panels-p44.tsx"), "function Sparkline", "sparkline", errors);
    must(read("src/components/dashboard/dashboard-panels-p44.tsx"), "timeseriesByMetric", "metric series", errors);
    return errors;
  },
  "analytics-production-ui": () => {
    const errors = [];
    must(read("src/components/dashboard/dashboard-panels-p44.tsx"), "preserveAspectRatio=\"xMidYMid meet\"", "chart aspect", errors);
    must(read("src/components/dashboard/dashboard-panels-p44.tsx"), "h-36", "taller chart", errors);
    return errors;
  },
  "forgot-password-redirect": () => {
    const errors = [];
    must(read("src/lib/auth/oauth-redirect.ts"), "getCanonicalOAuthRedirectTo", "canonical reset redirect", errors);
    mustNot(read("src/lib/auth/oauth-redirect.ts"), "type=recovery", "no query on reset redirect", errors);
    must(read("src/app/auth/callback/route.ts"), "isPasswordRecovery", "recovery detection", errors);
    return errors;
  },
};

function mustNot(src, needle, label, errors) {
  if (src.includes(needle)) errors.push(label);
}

const check = process.argv[2] ?? "";

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
  console.log("\nAll P1.3.19/P1.3.20 verification suites passed.");
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
