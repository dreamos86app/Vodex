#!/usr/bin/env node
/**
 * P1.3.32 — Production readiness report preview JSON parsing gates.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractFirstJsonObject, isPreviewDiagnosticsPass } from "./lib/extract-json-object.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const noisyStdout = `
> vodex-platform@0.1.0 verify:preview-diagnostics
> npx tsx scripts/run-preview-diagnostics.ts --project ff55c353-aabf-479a-aaec-2138bba9d6b4

(node:12345) Warning: something about TLS
{
  "project_id": "ff55c353-aabf-479a-aaec-2138bba9d6b4",
  "preview_renderable": true,
  "unsafe_path_count": 0,
  "hydration_path_count": 0,
  "rebuild_required": false,
  "issues": []
}
`;

const parsed = extractFirstJsonObject(noisyStdout);
assert(parsed?.project_id === "ff55c353-aabf-479a-aaec-2138bba9d6b4", "extract from noisy stdout");
assert(isPreviewDiagnosticsPass(parsed), "strict PASS on clean fixture");

const failFixture = { ...parsed, unsafe_path_count: 1, issues: ["leak"] };
assert(!isPreviewDiagnosticsPass(failFixture), "strict FAIL when leaks present");

const reportSrc = fs.readFileSync(path.join(root, "scripts/production-readiness-report.mjs"), "utf8");
assert(reportSrc.includes("fetch-preview-diagnostics.ts"), "report uses direct diagnostics loader");
assert(reportSrc.includes("isPreviewDiagnosticsPass"), "report uses strict PASS rule");
assert(reportSrc.includes("extractFirstJsonObject(r.stdout"), "report parses stdout only");

const r = spawnSync(
  "npx",
  ["tsx", "scripts/lib/fetch-preview-diagnostics.ts", "--project", "ff55c353-aabf-479a-aaec-2138bba9d6b4", "--compact"],
  {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NODE_USE_SYSTEM_CA: process.env.NODE_USE_SYSTEM_CA ?? "1" },
    shell: process.platform === "win32",
  },
);

if (r.status === 0) {
  const live = extractFirstJsonObject(r.stdout ?? "");
  assert(live?.project_id, "live compact stdout parses to diagnostics object");
  console.log(`✓ live compact diagnostics parse (renderable=${live.preview_renderable}, unsafe=${live.unsafe_path_count})`);
} else if (/fetch failed|Missing NEXT_PUBLIC_SUPABASE_URL/i.test(`${r.stdout}${r.stderr}`)) {
  console.log("✓ live compact parse skipped (remote DB unavailable)");
} else {
  throw new Error(`fetch-preview-diagnostics failed: ${(r.stderr || r.stdout || "").slice(0, 300)}`);
}

console.log("✓ verify:production-readiness-preview-parse");
