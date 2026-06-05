import fs from "node:fs";
import path from "node:path";
import { createChecker } from "./p42-verify-checks.mjs";

function mustNotInAuthClient(root, needle, label) {
  const errors = [];
  const files = [
    "src/lib/publish/published-auth-pages.ts",
    "src/app/p/[slug]/auth/callback/route.ts",
    "src/app/api/public/[slug]/auth/oauth/route.ts",
    "src/app/api/public/[slug]/auth/sync/route.ts",
  ];
  for (const rel of files) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    if (fs.readFileSync(p, "utf8").includes(needle)) errors.push(`${label}: ${rel}`);
  }
  return errors;
}

export const P45_CHECKS = {
  "p45-auth-runtime": (root) => {
    const { errors, must, mustExist, mustNot } = createChecker(root);
    mustExist("src/lib/publish/published-auth-pages.ts", "published auth pages");
    mustExist("src/app/p/[slug]/auth/callback/route.ts", "published auth callback");
    mustExist("src/app/api/public/[slug]/auth/oauth/route.ts", "oauth start route");
    must("src/lib/publish/published-auth-pages.ts", "supabase.createClient", "supabase client");
    mustNot("src/lib/publish/published-auth-pages.ts", "SERVICE_ROLE", "no service role in auth pages");
    mustNot("src/lib/publish/published-auth-pages.ts", "configure in Vodex Auth settings", "no fake setup prompt");
    errors.push(...mustNotInAuthClient(root, "SERVICE_ROLE", "service role in published auth"));
    return errors;
  },
  "p45-user-sync": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/lib/publish/app-user-profile-sync.ts", "user sync");
    mustExist("src/app/api/public/[slug]/auth/sync/route.ts", "auth sync API");
    mustExist("supabase/migrations/20260821120000_p45_app_user_profiles_auth_sync.sql", "p45 migration");
    must("src/lib/publish/app-user-profile-sync.ts", "app_user_profiles", "profiles table");
    must("src/lib/publish/app-user-profile-sync.ts", "auth_user_id", "auth_user_id column");
    return errors;
  },
  "p45-published-auth-analytics": (root) => {
    const { errors, must } = createChecker(root);
    must("src/lib/publish/app-user-profile-sync.ts", "signup_success", "signup analytics");
    must("src/lib/publish/published-analytics-server.ts", "app_analytics_events", "server analytics");
    must("src/app/api/projects/[id]/analytics/route.ts", "login_success", "login analytics read");
    return errors;
  },
  "p45-base44-auth-rewrite": (root) => {
    const { errors, must } = createChecker(root);
    must("src/lib/publish/strip-legacy-platform-badges.ts", "base44", "base44 strip");
    return errors;
  },
  "p45-no-fake-auth": (root) => {
    const { errors, mustNot } = createChecker(root);
    mustNot("src/lib/publish/published-auth-pages.ts", "alert(", "no alert fake auth");
    mustNot("src/lib/publish/published-auth-pages.ts", "connect Supabase Auth in your Vodex dashboard", "no fake message");
    return errors;
  },
};
