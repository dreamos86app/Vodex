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
  "destructive-action-email-verification": () => {
    const errors = [];
    must(
      read("src/lib/email/send-destructive-action-email.ts"),
      "Confirm destructive action on Vodex",
      "email subject",
      errors,
    );
    must(read("src/lib/security/destructive-action-verification.ts"), "OTP_TTL_MS", "otp ttl", errors);
    must(
      read("supabase/migrations/20260724120000_destructive_action_verifications.sql"),
      "destructive_action_verifications",
      "migration table",
      errors,
    );
    must(
      read("src/app/api/security/destructive-action/start/route.ts"),
      "startDestructiveActionVerification",
      "start api",
      errors,
    );
    return errors;
  },
  "delete-app-requires-verification": () => {
    const errors = [];
    must(
      read("src/components/projects/project-dashboard.tsx"),
      "DestructiveActionModal",
      "project modal",
      errors,
    );
    must(
      read("src/components/projects/project-dashboard.tsx"),
      "delete-secure",
      "secure delete api",
      errors,
    );
    must(
      read("src/components/projects/project-dashboard.tsx"),
      "delete-project-trigger",
      "delete trigger",
      errors,
    );
    const dash = read("src/components/projects/project-dashboard.tsx");
    if (dash.includes('.from("projects").delete()')) {
      errors.push("direct supabase project delete still present");
    }
    return errors;
  },
  "delete-workspace-requires-verification": () => {
    const errors = [];
    must(
      read("src/app/(app)/settings/page.tsx"),
      "DestructiveActionModal",
      "workspace modal",
      errors,
    );
    must(
      read("src/app/(app)/settings/page.tsx"),
      "delete-workspace-trigger",
      "workspace trigger",
      errors,
    );
    must(
      read("src/app/(app)/settings/page.tsx"),
      "/api/workspace/delete-secure",
      "workspace secure api",
      errors,
    );
    return errors;
  },
  "footer-iced-birds-visible": () => {
    const errors = [];
    must(read("src/components/layout/footer-iced-birds.tsx"), "footer-iced-birds", "birds testid", errors);
    must(read("src/components/layout/footer-iced-birds.tsx"), "footer-iced-bird-a", "bird a", errors);
    must(read("src/components/layout/footer-iced-birds.tsx"), "footer-iced-bird-b", "bird b", errors);
    must(read("src/components/layout/icy-bird-svg.tsx"), "IcyBirdSvgA", "real svg bird", errors);
    must(read("src/app/globals.css"), "vodex-footer-birds-layer", "birds layer css", errors);
    must(read("src/app/globals.css"), "vodex-footer-orbit-spin-a", "orbit animation", errors);
    must(read("src/components/layout/vodex-important-links-footer.tsx"), "FooterIcedBirds", "footer wired", errors);
    return errors;
  },
  "footer-iced-birds-loop": () => {
    const errors = [];
    const css = read("src/app/globals.css");
    must(css, "vodex-footer-orbit-spin-a", "loop a", errors);
    must(css, "vodex-footer-orbit-spin-b", "loop b", errors);
    must(css, "infinite", "infinite loop", errors);
    must(css, "vodex-footer-trail-fade", "trail fade", errors);
    if (!css.includes("24s linear infinite") && !css.includes("28s linear infinite")) {
      errors.push("loop duration missing");
    }
    return errors;
  },
  "footer-section-spacing": () => {
    const errors = [];
    must(read("src/app/globals.css"), "vodex-pre-footer-spacing", "spacing class", errors);
    must(read("src/components/community/community-view.tsx"), "vodex-pre-footer-spacing", "community spacing", errors);
    must(read("src/components/marketplace/marketplace-view.tsx"), "vodex-pre-footer-spacing", "marketplace spacing", errors);
    must(read("src/components/templates/templates-view.tsx"), "vodex-pre-footer-spacing", "templates spacing", errors);
    return errors;
  },
  "changelog-latest-entry": () => {
    const errors = [];
    const data = read("src/lib/data.ts");
    must(data, "Platform Control, Status, Community & Generation Polish", "changelog title", errors);
    must(data, "Safer destructive-action flow", "destructive highlight", errors);
    must(data, "New public Vodex Status page", "status highlight", errors);
    const first = data.indexOf("export const changelog");
    const firstEntry = data.indexOf('id: "platform-control-status-community-may-2026"', first);
    const secondEntry = data.indexOf('id: "production-reliability-may-2026"', first);
    if (firstEntry < 0 || secondEntry < 0 || firstEntry > secondEntry) {
      errors.push("platform-control entry must be first changelog item");
    }
    return errors;
  },
};

const check = process.argv[2] ?? "";
const names = check ? [check] : Object.keys(suites);
let failed = 0;

for (const name of names) {
  const fn = suites[name];
  if (!fn) {
    console.error(`Unknown check: ${name}`);
    failed++;
    continue;
  }
  console.log(`\n=== verify:${name} ===\n`);
  const errors = fn();
  if (errors.length) {
    failed++;
    for (const e of errors) console.error(`✗ ${e}`);
  } else {
    console.log("✓ OK");
  }
}

process.exit(failed > 0 ? 1 : 0);
