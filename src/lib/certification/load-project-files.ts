import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  filterRenderableBuildFiles,
  isPageSourceFile,
} from "@/lib/build/generated-file-utils";
import type { PublishedSnapshotFile } from "@/lib/publish/published-snapshot";

const MAX_FILES = 250;
const MAX_BYTES = 4_000_000;

function isCertificationPriorityPath(path: string): boolean {
  const p = path.replace(/\\/g, "/");
  return (
    p === "package.json" ||
    /index\.html$/i.test(p) ||
    isPageSourceFile(p) ||
    /^src\/App\./i.test(p) ||
    /^src\/main\./i.test(p)
  );
}

function prioritizeCertificationFiles(
  files: Array<{ path: string; content: string }>,
): Array<{ path: string; content: string }> {
  const priority: Array<{ path: string; content: string }> = [];
  const rest: Array<{ path: string; content: string }> = [];
  for (const file of files) {
    if (isCertificationPriorityPath(file.path)) priority.push(file);
    else rest.push(file);
  }
  return [...priority, ...rest];
}

function capFiles(files: Array<{ path: string; content: string }>): Array<{ path: string; content: string }> {
  const out: Array<{ path: string; content: string }> = [];
  let bytes = 0;
  for (const file of prioritizeCertificationFiles(files)) {
    bytes += file.content.length;
    if (bytes > MAX_BYTES) break;
    out.push(file);
    if (out.length >= MAX_FILES) break;
  }
  return out;
}

export function filesFromPublishedSnapshot(
  snapshot: unknown,
): Array<{ path: string; content: string }> {
  if (!Array.isArray(snapshot)) return [];
  const rows = snapshot
    .filter(
      (row): row is PublishedSnapshotFile =>
        Boolean(row) &&
        typeof row === "object" &&
        "path" in row &&
        "content" in row &&
        typeof (row as PublishedSnapshotFile).path === "string",
    )
    .map((row) => ({
      path: String(row.path),
      content: String(row.content ?? ""),
    }));
  return filterRenderableBuildFiles(rows);
}

export async function loadCertificationProjectFiles(
  admin: SupabaseClient,
  projectId: string,
  opts?: { publishedSnapshot?: unknown },
): Promise<Array<{ path: string; content: string }>> {
  const fromSnapshot = opts?.publishedSnapshot
    ? filesFromPublishedSnapshot(opts.publishedSnapshot)
    : [];
  if (fromSnapshot.length > 0) {
    return capFiles(fromSnapshot);
  }

  const { data: priorityRows } = await admin
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId)
    .or(
      [
        "path.ilike.%/page.tsx",
        "path.ilike.%/page.jsx",
        "path.ilike.%index.html",
        "path.eq.package.json",
        "path.ilike.src/pages/%",
        "path.ilike.src/App.%",
        "path.ilike.src/main.%",
      ].join(","),
    )
    .limit(100);

  const { data: orderedRows } = await admin
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId)
    .order("path")
    .limit(MAX_FILES);

  const seen = new Set<string>();
  const merged: Array<{ path: string; content: string }> = [];
  for (const row of [...(priorityRows ?? []), ...(orderedRows ?? [])]) {
    const path = String(row.path ?? "");
    const content = String(row.content ?? "");
    if (!path || seen.has(path)) continue;
    seen.add(path);
    merged.push({ path, content });
  }

  return capFiles(filterRenderableBuildFiles(merged));
}
