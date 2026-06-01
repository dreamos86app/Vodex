#!/usr/bin/env node
/**
 * P0.3 — canonical card_status on APIs and all project card surfaces.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const cardStatus = read("src/lib/projects/project-card-status.ts");
const badges = read("src/lib/projects/user-safe-project-badges.ts");
const homeApi = read("src/app/api/home/recent-projects/route.ts");
const projectsApi = read("src/app/api/projects/route.ts");
const buildStatusApi = read("src/app/api/projects/[id]/build-status/route.ts");
const homeUi = read("src/components/os-home/your-apps-section.tsx");
const projectsUi = read("src/components/apps/projects-view.tsx");
const dashboardUi = read("src/components/create/workspace/app-dashboard-panel.tsx");
const pkg = read("package.json");

const checks = [
  ["computeProjectCardStatus exported", () => cardStatus.includes("export function computeProjectCardStatus")],
  ["all five card statuses defined", () =>
    ["building", "preview_preparing", "preview_failed", "ready", "failed"].every((s) =>
      cardStatus.includes(`"${s}"`),
    )],
  ["Preparing preview label", () => cardStatus.includes('preview_preparing: "Preparing preview"')],
  ["preview_failed never maps to Ready label", () =>
    !cardStatus.includes('preview_failed: "Ready"') && cardStatus.includes('preview_failed: "Preview failed"')],
  ["badges resolve card_status first", () => badges.includes("resolveProjectCardStatus")],
  ["badges export resolveProjectCardStatus", () => badges.includes("export function resolveProjectCardStatus")],
  ["Repair preview CTA", () => cardStatus.includes("Repair preview")],
  ["Retry build CTA", () => cardStatus.includes("Retry build")],
  ["Admin diagnostics CTA", () => cardStatus.includes("Open diagnostics")],
  ["home API uses computeProjectCardStatus", () => homeApi.includes("computeProjectCardStatus")],
  ["projects API returns card_status", () => projectsApi.includes("card_status") && projectsApi.includes("computeProjectCardStatus")],
  ["build-status API uses shared helper", () => buildStatusApi.includes("computeProjectCardStatus")],
  ["home cards use resolveProjectCardStatus", () => homeUi.includes("resolveProjectCardStatus")],
  ["apps grid gates preview on ready", () => projectsUi.includes('cardStatus === "ready"')],
  ["dashboard uses card_status API", () => dashboardUi.includes("/build-status") && dashboardUi.includes("effectiveCardStatus")],
  ["npm script verify:home-card-status", () => pkg.includes('"verify:home-card-status"')],
];

let failed = 0;
for (const [label, fn] of checks) {
  try {
    fn();
    console.log(`OK ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL ${label}:`, e instanceof Error ? e.message : e);
  }
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log(`\n${checks.length} check(s) passed.`);
