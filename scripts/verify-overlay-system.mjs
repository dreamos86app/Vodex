#!/usr/bin/env node
/**
 * P1.3.12 — Global overlay system verification + audit report.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function must(cond, msg, errors) {
  if (!cond) errors.push(msg);
}

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walk(p, acc);
    } else if (/\.(tsx|ts|jsx|js|css)$/.test(ent.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const LAYER_VARS = [
  "--z-base",
  "--z-dropdown",
  "--z-popover",
  "--z-tooltip",
  "--z-context-menu",
  "--z-sheet",
  "--z-dialog-backdrop",
  "--z-dialog",
  "--z-confirmation",
  "--z-command-palette",
  "--z-critical-alert",
  "--z-toast",
  "--z-debug",
];

const OVERLAY_KEYWORDS = /Dialog|Modal|Drawer|Popover|Tooltip|Dropdown|Menu|Sheet|Toaster|FloatingMenu/i;

function auditOverlays() {
  const files = walk(SRC);
  const rows = [];
  const hardcoded = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    const text = fs.readFileSync(file, "utf8");
    const zMatches = [...text.matchAll(/z-\[(\d+)\]|zIndex:\s*(\d+)/g)];
    for (const m of zMatches) {
      const val = m[1] ?? m[2];
      if (Number(val) >= 80) {
        hardcoded.push({ file: rel, value: val });
      }
    }
    if (!OVERLAY_KEYWORDS.test(rel) && !OVERLAY_KEYWORDS.test(text.slice(0, 500))) continue;
    const portalized =
      text.includes("Portal") ||
      text.includes("createPortal") ||
      text.includes("OverlayDialog") ||
      text.includes("FloatingMenu");
    let layer = "unknown";
    if (text.includes('layer="confirmation"') || rel.includes("destructive-action")) layer = "confirmation";
    else if (text.includes("FloatingMenu") || rel.includes("overflow-menu")) layer = "contextMenu/popover";
    else if (text.includes("OverlayDialog") || rel.includes("modal")) layer = "dialog/confirmation";
    else if (text.includes("version-history-drawer")) layer = "sheet";
    else if (rel.includes("toaster")) layer = "toast";
    else if (rel.includes("command-center")) layer = "commandPalette";

    if (portalized || /Modal|Drawer|Menu|Popover|Toaster/i.test(rel)) {
      rows.push({ component: rel, currentLayer: layer, newLayer: layer, portalized });
    }
  }

  return { rows, hardcoded };
}

function runSuite(name, fn) {
  const errors = fn();
  if (errors.length) {
    console.error(`\n✗ ${name}`);
    for (const e of errors) console.error(`  - ${e}`);
    return false;
  }
  console.log(`✓ ${name}`);
  return true;
}

const suites = {
  foundation: () => {
    const errors = [];
    const css = read("src/app/globals.css");
    for (const v of LAYER_VARS) must(css.includes(v), `missing ${v} in globals.css`, errors);
    must(read("src/components/ui/overlay-layers.ts").includes("overlayZClass"), "overlay-layers", errors);
    must(read("src/components/ui/portal-root.tsx").includes("getPortalContainer"), "portal-root", errors);
    must(read("src/components/ui/overlay-provider.tsx").includes("OverlayProvider"), "overlay-provider", errors);
    must(read("src/components/ui/floating-menu.tsx").includes("FloatingMenu"), "floating-menu", errors);
    must(read("src/components/ui/overlay-dialog.tsx").includes("OverlayDialog"), "overlay-dialog", errors);
    must(
      read("src/components/providers/app-chrome-providers.tsx").includes("OverlayProvider"),
      "provider wired",
      errors,
    );
    return errors;
  },
  "app-card-menu": () => {
    const errors = [];
    const menu = read("src/components/apps/project-card-overflow-menu.tsx");
    must(menu.includes("FloatingMenu"), "card menu uses FloatingMenu", errors);
    must(menu.includes("OverlayDialog"), "rename uses OverlayDialog", errors);
    must(menu.includes("deleteOpen && !renameOpen"), "menu hidden when dialog open", errors);
    must(menu.includes('layer="contextMenu"'), "context menu layer", errors);
    return errors;
  },
  "dialog-over-menu": () => {
    const errors = [];
    const css = read("src/app/globals.css");
    const confirmation = /--z-confirmation:\s*(\d+)/.exec(css)?.[1];
    const contextMenu = /--z-context-menu:\s*(\d+)/.exec(css)?.[1];
    must(confirmation && contextMenu && Number(confirmation) > Number(contextMenu), "confirmation > context menu", errors);
    must(read("src/components/security/destructive-action-modal.tsx").includes("OverlayDialog"), "destructive portal dialog", errors);
    must(read("src/components/security/destructive-action-modal.tsx").includes('layer="confirmation"'), "destructive layer", errors);
    return errors;
  },
  "toast-over-dialog": () => {
    const errors = [];
    const css = read("src/app/globals.css");
    const toast = /--z-toast:\s*(\d+)/.exec(css)?.[1];
    const dialog = /--z-dialog:\s*(\d+)/.exec(css)?.[1];
    must(toast && dialog && Number(toast) > Number(dialog), "toast > dialog", errors);
    must(read("src/components/ui/toaster.tsx").includes("overlayZClass(\"toast\")"), "toaster layer", errors);
    return errors;
  },
  "esc-and-focus": () => {
    const errors = [];
    must(read("src/components/ui/overlay-provider.tsx").includes('e.key !== "Escape"'), "global ESC stack", errors);
    must(read("src/components/ui/overlay-dialog.tsx").includes("trapFocus"), "focus trap", errors);
    must(read("src/components/ui/overlay-provider.tsx").includes("returnFocusRef"), "focus return", errors);
    return errors;
  },
  "collision-detection": () => {
    const errors = [];
    must(read("src/hooks/use-floating-position.ts").includes("fitsBelow"), "flip collision", errors);
    must(read("src/components/ui/floating-menu.tsx").includes("useFloatingPosition"), "floating menu positioning", errors);
    return errors;
  },
  "portal-required-primitives": () => {
    const errors = [];
    for (const f of [
      "src/components/ui/vodex-confirm-modal.tsx",
      "src/components/chat/chat-delete-confirm-modal.tsx",
      "src/components/auth/logout-confirm-modal.tsx",
      "src/components/create/workspace/preview-page-switcher.tsx",
    ]) {
      must(read(f).includes("OverlayDialog") || read(f).includes("FloatingMenu"), `${f} migrated`, errors);
    }
    return errors;
  },
};

let ok = true;
for (const [name, fn] of Object.entries(suites)) {
  ok = runSuite(name, fn) && ok;
}

const { rows, hardcoded } = auditOverlays();
const reportDir = path.join(ROOT, "artifacts", "benchmarks", "p1312");
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, "overlay-audit.json");
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      layer_tokens: LAYER_VARS,
      components: rows,
      hardcoded_z_index_offenders: hardcoded.slice(0, 80),
      hardcoded_count: hardcoded.length,
    },
    null,
    2,
  ),
);
console.log(`\nAudit report: ${path.relative(ROOT, reportPath).replace(/\\/g, "/")}`);
console.log(`Components audited: ${rows.length}, hardcoded z-index (>=80): ${hardcoded.length}`);

if (!ok) process.exit(1);
console.log("\nverify:overlay-system passed");
