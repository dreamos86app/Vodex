import fs from "node:fs";
import path from "node:path";
import { createChecker } from "./p42-verify-checks.mjs";

export const P46_CHECKS = {
  "p46-auth-diagnostics": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/lib/publish/published-auth-diagnostics.ts", "auth diagnostics lib");
    mustExist("src/app/api/projects/[id]/auth/diagnostics/route.ts", "diagnostics route");
    mustExist("src/app/api/projects/[id]/auth/test-config/route.ts", "test-config route");
    must("src/lib/publish/published-auth-diagnostics.ts", "buildPublishedAuthDiagnostics", "diagnostics builder");
    must("src/components/settings/app-auth-settings-panel.tsx", "auth/diagnostics", "diagnostics panel");
    return errors;
  },
  "p46-custom-oauth": (root) => {
    const { errors, mustExist, must, mustNot } = createChecker(root);
    mustExist("src/lib/publish/custom-oauth-store.ts", "custom oauth store");
    mustExist("supabase/migrations/20260822120000_p46_auth_diagnostics_custom_oauth.sql", "p46 migration");
    must("src/lib/publish/custom-oauth-store.ts", "encryptSecretValue", "encrypted secrets");
    must("src/app/api/projects/[id]/auth-settings/route.ts", "validateCustomOAuthEnable", "custom oauth gate");
    mustNot("src/components/settings/app-auth-settings-panel.tsx", "client_secret_sealed", "no sealed secrets in client");
    return errors;
  },
  "p46-user-sync-hardening": (root) => {
    const { errors, must } = createChecker(root);
    must("src/lib/publish/app-user-profile-sync.ts", "last_seen_at", "last_seen_at sync");
    must("src/lib/publish/app-user-profile-sync.ts", "auth_provider", "provider sync");
    must("src/lib/publish/published-auth-diagnostics.ts", "recordPublishedAuthError", "auth error recording");
    return errors;
  },
  "p46-no-fake-auth": (root) => {
    const { errors, mustNot } = createChecker(root);
    mustNot("src/lib/publish/published-auth-pages.ts", "alert(", "no alert fake auth");
    mustNot("src/components/settings/app-auth-settings-panel.tsx", "setTimeout", "no fake test providers");
    return errors;
  },
  "p46-no-client-secrets": (root) => {
    const errors = [];
    const clientPaths = [
      "src/lib/publish/published-auth-pages.ts",
      "src/components/settings/app-auth-settings-panel.tsx",
    ];
    for (const rel of clientPaths) {
      const p = path.join(root, rel);
      if (!fs.existsSync(p)) continue;
      const src = fs.readFileSync(p, "utf8");
      if (src.includes("SERVICE_ROLE")) errors.push(`service role in client bundle path: ${rel}`);
      if (src.includes("SUPABASE_SERVICE_ROLE")) errors.push(`service role env in client: ${rel}`);
    }
    return errors;
  },
  "p46-base44-stripped": (root) => {
    const { errors, must } = createChecker(root);
    must("src/lib/publish/strip-legacy-platform-badges.ts", "base44", "base44 strip");
    return errors;
  },
};
