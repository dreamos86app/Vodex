import fs from "node:fs";
import path from "node:path";
import { createChecker } from "./p42-verify-checks.mjs";

const INTEGRATIONS = [
  "github",
  "supabase",
  "stripe",
  "paypal",
  "paddle",
  "lemon-squeezy",
  "revenuecat",
  "resend",
  "openai",
  "anthropic",
  "gemini",
  "firebase",
];

const PAYMENTS = ["stripe", "paypal", "paddle", "lemon-squeezy", "revenuecat"];

export const P48_CHECKS = {
  "p48-help-routes": (root) => {
    const { errors, mustExist } = createChecker(root);
    mustExist("src/app/(app)/help/page.tsx", "help home");
    mustExist("src/app/(app)/help/[category]/page.tsx", "category page");
    mustExist("src/app/(app)/help/[category]/[slug]/page.tsx", "article page");
    mustExist("src/lib/help/cms/registry.ts", "cms registry");
    return errors;
  },
  "p48-integration-guides": (root) => {
    const errors = [];
    const file = path.join(root, "src/lib/help/articles/integrations.ts");
    if (!fs.existsSync(file)) {
      errors.push("integrations articles missing");
      return errors;
    }
    const src = fs.readFileSync(file, "utf8");
    for (const id of INTEGRATIONS) {
      if (!src.includes(`slug: "${id}"`)) errors.push(`integration guide missing: ${id}`);
    }
    return errors;
  },
  "p48-payment-guides": (root) => {
    const errors = [];
    const file = path.join(root, "src/lib/help/articles/payments.ts");
    if (!fs.existsSync(file)) return ["payments articles missing"];
    const src = fs.readFileSync(file, "utf8");
    for (const id of PAYMENTS) {
      if (!src.includes(`slug: "${id}"`)) errors.push(`payment guide missing: ${id}`);
    }
    return errors;
  },
  "p48-mobile-auth-domains": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/lib/help/articles/mobile-apps.ts", "mobile academy");
    mustExist("src/lib/help/articles/authentication.ts", "auth academy");
    mustExist("src/lib/help/articles/domains.ts", "domains academy");
    must("src/lib/help/articles/mobile-apps.ts", "android-publishing", "android guide");
    must("src/lib/help/articles/mobile-apps.ts", "ios-publishing", "ios guide");
    return errors;
  },
  "p48-search": (root) => {
    const { errors, must } = createChecker(root);
    must("src/lib/help-search.ts", "HELP_ARTICLES", "search uses cms");
    must("src/components/help/help-view.tsx", "searchHelpArticles", "search in ui");
    return errors;
  },
  "p48-modal-docs-links": (root) => {
    const { errors, must } = createChecker(root);
    must("src/components/integrations/integration-connect-modal.tsx", "Open full guide", "modal guide link");
    must("src/components/integrations/integration-connect-modal.tsx", "integrationGuideHref", "guide href helper");
    return errors;
  },
  "p48-contextual-help": (root) => {
    const { errors, mustExist, must } = createChecker(root);
    mustExist("src/components/help/contextual-help.tsx", "contextual help");
    must("src/components/settings/app-auth-settings-panel.tsx", "ContextualHelp", "auth contextual");
    must("src/components/payments/project-payments-panel.tsx", "ContextualHelp", "payments contextual");
    return errors;
  },
};
