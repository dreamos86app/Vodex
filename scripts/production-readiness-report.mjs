#!/usr/bin/env node
/**
 * P1.3.32 — Final Production Readiness Report (runtime-validated PASS/FAIL).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAdmin,
  DEFAULT_PREVIEW_PROJECT_ID,
  arg,
  env,
} from "./lib/production-validation.mjs";
import { extractFirstJsonObject, isPreviewDiagnosticsPass } from "./lib/extract-json-object.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectId = arg("--project", DEFAULT_PREVIEW_PROJECT_ID);

function runNpm(script) {
  const r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", script], {
    cwd: root,
    encoding: "utf8",
    env: env(),
    shell: process.platform === "win32",
  });
  return { ok: r.status === 0, stdout: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

async function evaluatePreview() {
  const e = env();
  const url = e.NEXT_PUBLIC_SUPABASE_URL;
  const key = e.SUPABASE_SERVICE_ROLE_KEY ?? e.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    return { pass: false, detail: "missing Supabase credentials" };
  }

  const r = spawnSync(
    "npx",
    ["tsx", "scripts/lib/fetch-preview-diagnostics.ts", "--project", projectId, "--compact"],
    {
      cwd: root,
      encoding: "utf8",
      env: e,
      shell: process.platform === "win32",
    },
  );

  if (r.status !== 0) {
    const errText = `${r.stderr ?? ""}${r.stdout ?? ""}`.trim();
    return { pass: false, detail: errText.slice(0, 400) || "diagnostics loader failed" };
  }

  const report = extractFirstJsonObject(r.stdout ?? "");
  if (!report) {
    return {
      pass: false,
      detail: `could not parse diagnostics JSON (stdout bytes=${(r.stdout ?? "").length})`,
    };
  }

  const required = [
    "preview_url",
    "artifact_id",
    "artifact_path",
    "latest_worker_job",
    "latest_worker_status",
    "preview_renderable",
    "service_worker_detected",
    "next_data_detected",
    "next_f_detected",
    "flight_payload_detected",
    "router_cache_detected",
    "unsafe_path_count",
    "hydration_path_count",
    "current_iframe_url",
    "rebuild_required",
    "issues",
  ];
  const missing = required.filter((k) => !(k in report));
  if (missing.length) {
    return { pass: false, detail: `diagnostics missing fields: ${missing.join(", ")}` };
  }

  const endpointExists = fs.existsSync(
    path.join(root, "src/app/api/projects/[id]/preview/diagnostics/route.ts"),
  );
  if (!endpointExists) {
    return { pass: false, detail: "GET /api/projects/:id/preview/diagnostics route missing" };
  }

  const healthy = isPreviewDiagnosticsPass(report);

  return {
    pass: healthy,
    detail: healthy
      ? `renderable, job=${report.latest_worker_status}, 0 leaks, 0 issues`
      : `renderable=${report.preview_renderable}, rebuild_required=${report.rebuild_required}, unsafe=${report.unsafe_path_count}, hydration=${report.hydration_path_count}, issues=${(report.issues ?? []).join("; ") || "none"}`,
    report,
  };
}

async function evaluateCommunity() {
  const checks = [];
  const migration = fs.readFileSync(
    path.join(root, "supabase/migrations/20260906120000_community_report_fractional_credits.sql"),
    "utf8",
  );
  if (!migration.includes("community_report")) {
    checks.push("community_report migration missing");
  }

  const reportRoute = path.join(root, "src/app/api/community/report/route.ts");
  if (!fs.existsSync(reportRoute)) checks.push("community report API missing");

  const profileRoute = path.join(root, "src/app/api/community/profiles/[username]/route.ts");
  if (!fs.existsSync(profileRoute)) checks.push("public profile API missing");

  let liveOk = false;
  let liveDetail = "skipped";
  try {
    const admin = createAdmin();
    const { error: discErr } = await admin.from("discussions").select("id").limit(1);
    const { error: grpErr } = await admin.from("community_groups").select("id").limit(1);
    if (discErr && grpErr) {
      checks.push(`community tables: ${discErr.message}`);
    } else {
      liveOk = true;
      liveDetail = "discussions/groups readable via service role";
    }
  } catch (err) {
    checks.push(err.message);
  }

  return {
    pass: checks.length === 0 && liveOk,
    detail: checks.length ? checks.join("; ") : liveDetail,
  };
}

function banner(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 52 - title.length))}`);
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║     P1.3.32 Production Readiness Report              ║");
  console.log(`║     Project: ${projectId.slice(0, 36)}  ║`);
  console.log("╚══════════════════════════════════════════════════════╝");

  banner("Preview");
  const preview = await evaluatePreview();
  console.log(preview.pass ? "PASS" : "FAIL", "—", preview.detail);

  banner("Credits");
  const credits = runNpm("verify:billing-production-flow");
  console.log(credits.ok ? "PASS" : "FAIL", "—", credits.ok ? "fractional discuss + preview action credits validated" : credits.stdout.slice(0, 500));

  banner("Chat Persistence");
  const chat = runNpm("verify:chat-persistence");
  console.log(chat.ok ? "PASS" : "FAIL", "—", chat.ok ? "static + live DB round-trip" : chat.stdout.slice(0, 500));

  banner("Community");
  const community = await evaluateCommunity();
  console.log(community.pass ? "PASS" : "FAIL", "—", community.detail);

  console.log("\n┌─────────────────────┬────────┐");
  console.log("│ Area                │ Result │");
  console.log("├─────────────────────┼────────┤");
  console.log(`│ Preview             │ ${preview.pass ? "PASS  " : "FAIL  "} │`);
  console.log(`│ Credits             │ ${credits.ok ? "PASS  " : "FAIL  "} │`);
  console.log(`│ Chat Persistence    │ ${chat.ok ? "PASS  " : "FAIL  "} │`);
  console.log(`│ Community           │ ${community.pass ? "PASS  " : "FAIL  "} │`);
  console.log("└─────────────────────┴────────┘\n");

  const allPass = preview.pass && credits.ok && chat.ok && community.pass;
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
