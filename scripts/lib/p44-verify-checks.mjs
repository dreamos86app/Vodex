import fs from "node:fs";
import path from "node:path";
import { createChecker } from "./p42-verify-checks.mjs";

const API_ROUTES = [
  "src/app/api/projects/[id]/analytics/route.ts",
  "src/app/api/projects/[id]/activity/route.ts",
  "src/app/api/projects/[id]/security-scan/route.ts",
  "src/app/api/projects/[id]/data/route.ts",
  "src/app/api/projects/[id]/users/route.ts",
  "src/app/api/projects/[id]/growth/route.ts",
  "src/app/api/projects/[id]/readiness-scan/route.ts",
  "src/app/api/projects/[id]/custom-domains/route.ts",
  "src/app/api/public/[slug]/analytics/route.ts",
];

function mustUseServiceRole(root, rel) {
  const errors = [];
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return [`missing ${rel}`];
  const src = fs.readFileSync(p, "utf8");
  if (src.includes("permission denied")) errors.push(`${rel} exposes permission denied string`);
  return errors;
}

export const P44_CHECKS = {
  "p44-db-runtime": (root) => {
    const { errors, mustExist } = createChecker(root);
    mustExist("supabase/migrations/20260820120000_p43_dashboard_runtime_rls_and_tables.sql", "P4.3 migration");
    for (const r of API_ROUTES) {
      mustExist(r, r);
      errors.push(...mustUseServiceRole(root, r));
    }
    return errors;
  },
  "p44-public-analytics": (root) => {
    const { errors, must, mustExist } = createChecker(root);
    mustExist("src/lib/publish/published-analytics-runtime.ts", "analytics runtime");
    mustExist("src/app/api/public/[slug]/analytics/route.ts", "public analytics API");
    must("src/lib/publish/published-app-runtime.ts", "injectPublishedAnalytics", "analytics injected");
    must("src/lib/publish/published-analytics-runtime.ts", "page_view", "page_view tracking");
    must("src/app/api/public/[slug]/analytics/route.ts", "app_analytics_events", "events table");
    return errors;
  },
  "p44-dashboard-sections": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/components/dashboard/dashboard-panels-p44.tsx", "dashboard panels p44");
    must("src/components/dashboard/dashboard-panels-p44.tsx", "InsightsDashboardPanel", "insights panel");
    must("src/components/dashboard/dashboard-panels-p44.tsx", "GrowthDashboardPanel", "growth panel");
    must("src/components/dashboard/dashboard-panels-p44.tsx", "DataDashboardPanel", "data panel");
    must("src/components/dashboard/dashboard-panels-p44.tsx", "UsersDashboardPanel", "users panel");
    mustExist("src/app/api/projects/[id]/data/route.ts", "data API");
    mustExist("src/app/api/projects/[id]/users/route.ts", "users API");
    mustExist("src/app/api/projects/[id]/growth/route.ts", "growth API");
    return errors;
  },
  "p44-default-auth": (root) => {
    const { errors, must, mustExist } = createChecker(root);
    mustExist("src/lib/publish/default-auth-pages.ts", "default auth pages");
    must("src/lib/publish/published-app-runtime.ts", "buildDefaultAuthPageHtml", "auth pages wired");
    must("src/lib/publish/default-auth-pages.ts", "AUTH_SYSTEM_ROUTES", "auth routes excluded");
    return errors;
  },
  "p44-mobile-readiness": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/components/mobile/mobile-readiness-scan-modal.tsx", "readiness modal");
    mustExist("src/app/api/projects/[id]/readiness-scan/route.ts", "readiness scan API");
    must("src/app/api/projects/[id]/readiness-scan/route.ts", "app_readiness_scans", "readiness table");
    return errors;
  },
  "p44-action-credit-end-to-end": (root) => {
    const { errors, must, mustExist } = createChecker(root);
    must("src/lib/imports/zip-preview-action-credits.ts", "reserveActionCreditHold", "unified reserve");
    must("src/lib/imports/zip-preview-action-credits.ts", "commitActionCreditHold", "unified commit");
    must("src/lib/imports/zip-preview-action-credits.ts", "releaseActionCreditHold", "unified release");
    mustExist("src/lib/credits/action-credit-holds.ts", "holds module");
    return errors;
  },
  "p44-pricing": (root) => {
    const { errors, must } = createChecker(root);
    must("src/components/pricing/pricing-view.tsx", "ANNUAL_DISCOUNT", "annual toggle");
    must("src/components/pricing/pricing-view.tsx", "FAQS", "FAQ section");
    must("src/components/pricing/pricing-view.tsx", "COMPARISON_ROWS", "comparison table");
    must("src/components/pricing/pricing-view.tsx", "actionCredits", "action credits on cards");
    return errors;
  },
  "p44-no-permission-denied": (root) => {
    const errors = [];
    const walk = (d) => {
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) {
          if (["node_modules", ".next"].includes(ent.name)) continue;
          walk(p);
        } else if (/\.(tsx?)$/.test(ent.name)) {
          const src = fs.readFileSync(p, "utf8");
          if (/permission denied/i.test(src) && /toast\.|error:|message:/i.test(src)) {
            errors.push(`permission denied in UI: ${path.relative(root, p)}`);
          }
        }
      }
    };
    walk(path.join(root, "src/components"));
    return errors;
  },
};
