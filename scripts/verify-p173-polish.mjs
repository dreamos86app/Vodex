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
  "template-duplicates-real-project": () => {
    const errors = [];
    must(read("src/lib/templates/duplicate-template-to-project.ts"), "duplicateTemplateToProject", "duplicate fn", errors);
    must(read("src/lib/templates/duplicate-template-to-project.ts"), 'source: "template"', "template source metadata", errors);
    must(read("src/lib/templates/duplicate-template-to-project.ts"), "app_files", "app_files upsert", errors);
    must(read("src/lib/templates/template-source-files.ts"), "getTemplateSourceFiles", "source files", errors);
    must(read("src/app/api/templates/[id]/use/route.ts"), "duplicateTemplateToProject", "use api", errors);
    return errors;
  },
  "template-does-not-generate-name-or-logo": () => {
    const errors = [];
    const dup = read("src/lib/templates/duplicate-template-to-project.ts");
    must(dup, "buildTemplateIconSvg", "template icon", errors);
    must(dup, "skip_identity_generation", "skip identity", errors);
    if (dup.includes("generateAppIdentity") || dup.includes("regenerateAppLogo")) {
      errors.push("must not call AI identity generation");
    }
    if (dup.includes("ensureProjectIconSvg")) {
      errors.push("must not replace template icon with ensureProjectIconSvg");
    }
    return errors;
  },
  "footer-gap-global": () => {
    const errors = [];
    must(read("src/app/globals.css"), "margin-top: clamp(3rem", "footer margin-top", errors);
    const pre = read("src/app/globals.css");
    if (!pre.includes(".vodex-pre-footer-spacing") || !pre.includes("margin-bottom: 0")) {
      errors.push("pre-footer spacing must not double gap");
    }
    return errors;
  },
  "credits-used-up-card-polish": () => {
    const errors = [];
    const panel = read("src/components/billing/build-credits-upgrade-panel.tsx");
    must(panel, "Build Credits are used up", "title", errors);
    must(panel, "text-foreground", "theme text", errors);
    must(panel, "max-w-[min(100%,340px)]", "assistant width", errors);
    must(panel, "Upgrade to Starter", "starter cta", errors);
    must(read("src/lib/billing/build-credits-upgrade.ts"), "Faster generation", "perks", errors);
    must(read("src/lib/billing/build-credits-upgrade.ts"), "and more…", "perks more", errors);
    return errors;
  },
  "dark-mode-footer-discord": () => {
    const errors = [];
    must(read("src/app/globals.css"), ".dark .vodex-important-links-footer", "footer dark", errors);
    must(read("src/app/globals.css"), ".dark .vodex-discord-card-icy", "discord dark", errors);
    must(read("src/app/globals.css"), ".dark .build-credits-upgrade-panel", "credits dark", errors);
    return errors;
  },
  "icy-birds-visible-real-svg": () => {
    const errors = [];
    must(read("src/components/layout/icy-bird-svg.tsx"), "IcyBirdSvgA", "bird a", errors);
    must(read("src/components/layout/icy-bird-svg.tsx"), "<path", "bird path", errors);
    must(read("src/components/layout/footer-iced-birds.tsx"), "IcyBirdSvgA", "footer uses svg", errors);
    must(read("src/components/layout/footer-iced-birds.tsx"), "data-testid=\"footer-iced-birds\"", "testid", errors);
    return errors;
  },
  "icy-birds-loop-and-trail": () => {
    const errors = [];
    must(read("src/app/globals.css"), "vodex-footer-orbit-spin-a", "orbit a", errors);
    must(read("src/app/globals.css"), "vodex-footer-trail-fade", "trail fade", errors);
    must(read("src/app/globals.css"), "vodex-footer-bird-trail-streak", "trail streak", errors);
    const css = read("src/app/globals.css");
    if (!css.includes("infinite")) errors.push("infinite loop animations");
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
  const errors = fn();
  if (errors.length) {
    console.error(`FAIL ${name}:`);
    for (const e of errors) console.error(`  - ${e}`);
    failed++;
  } else {
    console.log(`OK ${name}`);
  }
}

process.exit(failed ? 1 : 0);
