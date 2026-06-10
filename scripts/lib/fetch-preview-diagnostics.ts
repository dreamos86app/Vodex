/**
 * CLI-safe preview diagnostics loader (no Next server-only chain).
 */
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildPreviewDiagnosticsReport } from "../../src/lib/preview/build-preview-diagnostics-report";
import type { PreviewDiagnosticsReport } from "../../src/lib/preview/build-preview-diagnostics-report";

export function loadEnvLocal(root = process.cwd()): Record<string, string> {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

export function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

export function createDiagnosticsAdmin(env: Record<string, string>): SupabaseClient {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function loadPreviewDiagnosticsReport(
  projectId: string,
  root = process.cwd(),
): Promise<PreviewDiagnosticsReport | null> {
  const envLocal = loadEnvLocal(root);
  Object.assign(process.env, envLocal);
  if (!process.env.NODE_USE_SYSTEM_CA) process.env.NODE_USE_SYSTEM_CA = "1";
  const env = { ...process.env, ...envLocal } as Record<string, string>;
  const admin = createDiagnosticsAdmin(env);
  return buildPreviewDiagnosticsReport(admin, projectId);
}

export function isPreviewDiagnosticsPass(report: PreviewDiagnosticsReport): boolean {
  return (
    report.preview_renderable === true &&
    report.rebuild_required === false &&
    (report.unsafe_path_count ?? 0) === 0 &&
    (report.hydration_path_count ?? 0) === 0 &&
    (report.issues?.length ?? 0) === 0
  );
}

const isMain =
  process.argv[1]?.replace(/\\/g, "/").includes("fetch-preview-diagnostics") ?? false;

if (isMain) {
  const projectId = arg("--project", "ff55c353-aabf-479a-aaec-2138bba9d6b4");
  const compact = process.argv.includes("--compact");

  loadPreviewDiagnosticsReport(projectId)
    .then((report) => {
      if (!report) {
        process.stderr.write(`Project not found: ${projectId}\n`);
        process.exit(1);
      }
      if (compact) {
        process.stdout.write(JSON.stringify(report));
      } else {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      }
    })
    .catch((err) => {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    });
}
