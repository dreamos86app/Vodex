import fs from "node:fs";
import path from "node:path";
import { createChecker } from "./p42-verify-checks.mjs";

const P43_TABLES = [
  "custom_domains",
  "app_integration_connections",
  "app_auth_provider_settings",
  "app_watermark_settings",
  "template_votes",
  "app_analytics_events",
  "app_activity_events",
  "app_security_scans",
  "app_readiness_scans",
  "app_api_keys",
  "app_payment_provider_connections",
  "app_user_profiles",
  "app_growth_events",
];

function mustNotInSrc(root, needle, label) {
  const errors = [];
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === ".next") continue;
        walk(p);
      } else if (/\.(tsx?|jsx?|mjs)$/.test(ent.name)) {
        if (fs.readFileSync(p, "utf8").includes(needle)) errors.push(`${label}: ${path.relative(root, p)}`);
      }
    }
  };
  walk(path.join(root, "src"));
  return errors;
}

export const P43_CHECKS = {
  "p43-db-access": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist(
      "supabase/migrations/20260820120000_p43_dashboard_runtime_rls_and_tables.sql",
      "P4.3 migration",
    );
    const sql = fs.readFileSync(
      path.join(root, "supabase/migrations/20260820120000_p43_dashboard_runtime_rls_and_tables.sql"),
      "utf8",
    );
    for (const t of P43_TABLES) {
      if (!sql.includes(t)) errors.push(`migration missing table ${t}`);
    }
    if (!/notify\s+pgrst/i.test(sql)) errors.push("migration missing NOTIFY pgrst");
    mustExist("scripts/verify-p43-db-access.mjs", "verify-p43-db-access script");
    must("src/app/api/projects/[id]/custom-domains/route.ts", "createServiceRoleClient", "custom domains uses service role");
    return errors;
  },
  "imported-route-discovery": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/lib/preview/route-discovery.ts", "route-discovery.ts");
    mustExist("src/lib/preview/imported-app-route-manifest.ts", "imported-app-route-manifest.ts");
    must("src/lib/preview/route-discovery.ts", "discoverImportedAppRoutes", "route discovery export");
    must("src/app/api/projects/import-zip/route.ts", "buildImportedRouteManifest", "zip import persists manifest");
    mustExist("scripts/verify-imported-route-discovery.mjs", "verify-imported-route-discovery script");
    return errors;
  },
  "published-spa-routing": (root) => {
    const { errors, must, mustExist } = createChecker(root);
    must("src/lib/publish/rewrite-published-artifact-html.ts", "injectPreviewRouterShim", "SPA router shim");
    mustExist("scripts/verify-published-spa-routing.mjs", "spa routing verify script");
    return errors;
  },
  "published-runtime-watermark": (root) => {
    const { errors, must, mustExist } = createChecker(root);
    must("src/lib/publish/published-app-runtime.ts", "stripLegacyPlatformBadges", "legacy badge strip wired");
    must("src/lib/publish/published-app-runtime.ts", "buildPublishedRecoveryPage", "recovery page wired");
    must("src/lib/publish/watermark-runtime.ts", "Made with Vodex", "document-flow watermark");
    mustExist("scripts/verify-published-runtime-watermark.mjs", "watermark verify script");
    return errors;
  },
  "p43-action-credit-billing": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/lib/credits/action-credit-holds.ts", "action-credit-holds.ts");
    mustExist("src/lib/credits/action-credit-ledger.ts", "action-credit-ledger.ts");
    must("src/app/api/projects/import-zip/route.ts", "reserveZipPreviewActionCredits", "zip preview reserves credits");
    must("src/app/api/projects/import-zip/route.ts", "captureZipPreviewActionCredits", "zip preview captures credits");
    mustExist("scripts/verify-p43-action-credit-billing.mjs", "credit billing verify script");
    return errors;
  },
  "integrations-no-window-prompt": (root) => {
    const { errors, mustExist } = createChecker(root);
    mustExist("src/components/integrations/supabase-connect-modal.tsx", "supabase connect modal");
    return [...errors, ...mustNotInSrc(root, "window.prompt", "window.prompt found")];
  },
  "publish-checklist": (root) => {
    const { errors, must } = createChecker(root);
    must("src/lib/publish/integration-secret-readiness.ts", "severity", "gap severity levels");
    must("src/app/api/projects/[id]/publish/readiness/route.ts", "optionalIntegrations", "optional integrations in readiness");
    return errors;
  },
  "secrets-detection": (root) => {
    const { errors, must } = createChecker(root);
    must("src/lib/publish/integration-secret-readiness.ts", "SHIM_SATISFIED_KEYS", "base44 shim filter");
    must("src/lib/publish/integration-secret-readiness.ts", "envKeyReferencedInSource", "runtime env detection");
    return errors;
  },
  "dashboard-sections": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/app/api/projects/[id]/analytics/route.ts", "analytics API");
    mustExist("src/app/api/projects/[id]/activity/route.ts", "activity API");
    mustExist("src/app/api/projects/[id]/security-scan/route.ts", "security scan API");
    must("src/components/create/workspace/app-dashboard-live-sections.tsx", "projectId", "dashboard sections wired");
    return errors;
  },
  "security-scan": (root) => {
    const { errors, must } = createChecker(root);
    must("src/app/api/projects/[id]/security-scan/route.ts", "app_security_scans", "security scan table");
    must("src/components/create/workspace/app-dashboard-live-sections.tsx", "Run scan", "security scan UI");
    return errors;
  },
  "mobile-readiness-job": (root) => {
    const { errors } = createChecker(root);
    const sql = fs.readFileSync(
      path.join(root, "supabase/migrations/20260820120000_p43_dashboard_runtime_rls_and_tables.sql"),
      "utf8",
    );
    if (!sql.includes("app_readiness_scans")) errors.push("app_readiness_scans missing");
    return errors;
  },
};
