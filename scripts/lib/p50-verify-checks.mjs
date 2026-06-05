import fs from "node:fs";
import path from "node:path";
import { createChecker } from "./p42-verify-checks.mjs";
import { runP50CertificationRegression } from "./p50-certification-regression.mjs";

export const P50_CHECKS = {
  "p50-source-scan-module": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/lib/certification/source-scan.ts", "source scan");
    must("src/lib/certification/source-scan.ts", "detectCertificationSecretLeak", "secret leak");
    must("src/lib/certification/source-scan.ts", "placeholderCertificationStatus", "placeholder status");
    must("src/lib/certification/checks/app-audit.ts", "placeholderCertificationStatus", "app-audit uses scan");
    must("src/lib/certification/checks/publish.ts", "prepareCertificationFiles", "publish uses strip");
    return errors;
  },
  "p50-clear-auth-error": (root) => {
    const { errors, must } = createChecker(root);
    must("src/lib/publish/published-auth-diagnostics.ts", "clearPublishedAuthError", "clear helper");
    must("src/lib/publish/published-oauth-callback-handler.ts", "clearPublishedAuthError", "central callback clears");
    must("src/app/p/[slug]/auth/callback/route.ts", "clearPublishedAuthError", "app callback clears");
    return errors;
  },
  "p50-profile-sync-owner": (root) => {
    const { errors, must } = createChecker(root);
    must("src/lib/publish/published-oauth-callback-handler.ts", 'from("projects")', "owner fallback lookup");
    must("src/lib/publish/app-user-profile-sync.ts", "missing project owner_id", "owner guard");
    return errors;
  },
  "p50-published-url-fallback": (root) => {
    const { errors, must } = createChecker(root);
    must("src/lib/certification/load-context.ts", "canonical_url", "canonical url in loader");
    return errors;
  },
  "p50-runtime-migration": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist(
      "supabase/migrations/20260824120000_p50_certification_runtime_repair.sql",
      "p50 migration",
    );
    must(
      "supabase/migrations/20260824120000_p50_certification_runtime_repair.sql",
      "app_payment_events",
      "payment events repair",
    );
    return errors;
  },
  "p50-banned-ref-fix": (root) => {
    const errors = [];
    const fp = path.join(root, "src/lib/ai/file-fingerprint.ts");
    const src = fs.readFileSync(fp, "utf8");
    if (!src.includes("wciioegiczwqlmlroley")) {
      errors.push("file-fingerprint must ban legacy project ref");
    }
    if (src.includes('BANNED_REFS = ["xycqutvqxtkbszytaxbe"]')) {
      errors.push("file-fingerprint must not ban canonical project ref");
    }
    return errors;
  },
  "p50-regression-tests": async (root) => runP50CertificationRegression(root),
};
