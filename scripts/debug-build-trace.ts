#!/usr/bin/env npx tsx
/**
 * P1.3.17 — Inspect canonical build trace artifact.
 * Usage:
 *   npm run debug:build-trace -- --job <build_job_id>
 *   npm run debug:build-trace -- --project <project_id>
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(name: string) {
  const p = resolve(process.cwd(), name);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function printTrace(trace: Record<string, unknown>) {
  console.log("\n=== Build trace ===\n");
  const keys = [
    "build_job_id",
    "project_id",
    "prompt",
    "selected_model_label",
    "actual_model_id",
    "provider",
    "max_output_tokens",
    "model_duration_ms",
    "raw_model_response_size_chars",
    "parsed_file_count",
    "parsed_route_count",
    "parsed_component_count",
    "model_file_count",
    "scaffold_file_count",
    "fallback_used",
    "fallback_reason",
    "generic_scaffold_detected",
    "generic_scaffold_reasons",
    "continuation_attempts",
    "continuation_reasons",
    "quality_scores_by_attempt",
    "logo_generation_status",
    "logo_failure_reason",
    "import_graph_status",
    "missing_imports",
    "preview_status",
    "stream_health",
  ];
  for (const k of keys) {
    if (trace[k] !== undefined) console.log(`${k}:`, JSON.stringify(trace[k]));
  }
  console.log("\n--- Diagnostics ---");
  console.log("Model called:", Boolean(trace.actual_model_id));
  console.log("Files parsed:", trace.parsed_file_count ?? 0);
  console.log("Generic scaffold:", trace.generic_scaffold_detected ?? false);
  console.log("Fallback used:", trace.fallback_used ?? false);
  console.log("Continuation attempts:", trace.continuation_attempts ?? 0);
  console.log("Logo status:", trace.logo_generation_status ?? "unknown");
  console.log("Import graph:", trace.import_graph_status ?? "unknown");
  console.log("Preview:", trace.preview_status ?? "unknown");
}

async function main() {
  const jobId = arg("--job");
  const projectId = arg("--project");
  if (!jobId && !projectId) {
    console.error("Usage: debug:build-trace -- --job <id> | --project <id>");
    process.exit(1);
  }

  if (jobId) {
    const filePath = join(process.cwd(), "artifacts", "build-traces", `${jobId}.json`);
    if (existsSync(filePath)) {
      printTrace(JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>);
      return;
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for DB lookup.");
    process.exit(1);
  }
  const admin = createClient(url, key);
  let query = admin.from("build_jobs").select("id, project_id, meta, metadata, prompt, created_at").order("created_at", { ascending: false }).limit(1);
  if (jobId) query = query.eq("id", jobId);
  else if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    console.error("Build job not found:", error?.message ?? "no row");
    process.exit(1);
  }
  const meta =
    data.meta && typeof data.meta === "object"
      ? (data.meta as Record<string, unknown>)
      : data.metadata && typeof data.metadata === "object"
        ? (data.metadata as Record<string, unknown>)
        : {};
  const trace = meta.build_trace;
  if (!trace || typeof trace !== "object") {
    console.log("Job:", data.id, "project:", data.project_id);
    console.log("No build_trace in job metadata yet.");
    process.exit(1);
  }
  printTrace(trace as Record<string, unknown>);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
