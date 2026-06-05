import fs from "node:fs";
import path from "node:path";
import { createChecker } from "./p42-verify-checks.mjs";

export const P47_CHECKS = {
  "p47-integration-test-harness": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/lib/integrations/integration-test-harness.ts", "integration harness");
    mustExist("supabase/migrations/20260823120000_p47_integration_harness_payment_events.sql", "p47 migration");
    must("src/app/api/projects/[id]/integrations/[provider]/test/route.ts", "runIntegrationProviderTest", "test route");
    must("src/lib/integrations/app-runtime-connections.ts", "upsertAppIntegrationConnection", "runtime bridge");
    return errors;
  },
  "p47-payment-readiness": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/lib/generated-app-payments/payment-readiness.ts", "payment readiness");
    mustExist("src/app/api/projects/[id]/payments/readiness/route.ts", "readiness route");
    must("src/components/payments/project-payments-panel.tsx", "payments/readiness", "payments UI readiness");
    return errors;
  },
  "p47-central-oauth-callback": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/lib/publish/central-oauth-state.ts", "oauth state");
    mustExist("src/lib/publish/central-oauth-config.ts", "central oauth config");
    mustExist("src/lib/publish/published-oauth-callback-handler.ts", "published oauth handler");
    must("src/app/api/public/[slug]/auth/oauth/route.ts", "getCentralOAuthCallbackUrl", "central callback in oauth start");
    must("src/app/auth/callback/route.ts", "handlePublishedOAuthCallback", "central callback branch");
    must("src/lib/publish/published-auth-diagnostics.ts", "centralOAuthCallbackUrl", "diagnostics central url");
    return errors;
  },
  "p47-payment-events": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/lib/generated-app-payments/app-payment-events.ts", "payment events");
    mustExist("src/app/api/public/[slug]/payments/[provider]/webhook/route.ts", "public webhook");
    must("src/lib/generated-app-payments/app-payment-events.ts", "app_payment_events", "events table ref");
    return errors;
  },
  "p47-no-window-prompt": (root) => {
    const errors = [];
    function walk(dir) {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          if (ent.name === "node_modules" || ent.name === ".next") continue;
          walk(p);
        } else if (/\.(tsx?|jsx?)$/.test(ent.name)) {
          const src = fs.readFileSync(p, "utf8");
          if (src.includes("window.prompt")) errors.push(`window.prompt in ${p.replace(root, "")}`);
        }
      }
    }
    walk(path.join(root, "src"));
    return errors;
  },
  "p47-integration-ui": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/components/integrations/integration-connect-modal.tsx", "connect modal");
    mustExist("src/components/integrations/supabase-connect-modal.tsx", "supabase modal");
    must("src/components/integrations/integrations-catalog-panel.tsx", "IntegrationConnectModal", "catalog modal");
    must("src/components/create/workspace/workspace-integrations-modal.tsx", "SupabaseConnectModal", "builder modal");
    return errors;
  },
};
