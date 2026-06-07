import type { APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const CACHE_PATH = path.join(process.cwd(), "artifacts", "benchmarks", "p13", ".generated-project-cache.json");

export type GeneratedProjectCandidate = {
  id: string;
  name: string;
  fileCount: number;
  shortDescription?: string | null;
};

function readCache(): GeneratedProjectCandidate | null {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    const row = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as GeneratedProjectCandidate;
    return row?.id ? row : null;
  } catch {
    return null;
  }
}

function writeCache(row: GeneratedProjectCandidate) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(row, null, 2));
}

/** Resolve a generated (non zip_import) project with files — prefers Northly/finance names. */
export async function resolveGeneratedProjectId(
  request: APIRequestContext,
  opts?: { forceRefresh?: boolean },
): Promise<GeneratedProjectCandidate | null> {
  const envId = process.env.E2E_NORTHLY_PROJECT_ID?.trim() || process.env.E2E_GENERATED_PROJECT_ID?.trim();
  if (envId) {
    const cached = readCache();
    return { id: envId, name: cached?.name ?? "generated", fileCount: cached?.fileCount ?? 0 };
  }

  if (!opts?.forceRefresh) {
    const cached = readCache();
    if (cached) return cached;
  }

  const res = await request.get("/api/projects?reconcile=1", { timeout: 20_000 });
  if (!res.ok()) return readCache();
  const body = (await res.json()) as {
    projects?: Array<{
      id: string;
      name?: string;
      app_name?: string;
      short_description?: string | null;
      description?: string | null;
      metadata?: { source?: string };
    }>;
  };

  const generated = (body.projects ?? []).filter((p) => p.metadata?.source !== "zip_import");
  const northly = generated.filter(
    (p) =>
      /northly|finance|budget|ledger/i.test(p.name ?? "") ||
      /northly|finance|budget|ledger/i.test(p.app_name ?? "") ||
      /finance|budget|ledger/i.test(p.short_description ?? p.description ?? ""),
  );
  const candidates = (northly.length > 0 ? northly : generated).slice(0, 5);

  let best: GeneratedProjectCandidate | null = null;
  for (const p of candidates) {
    const filesRes = await request.get(`/api/projects/${p.id}/files`, { timeout: 8_000 });
    if (!filesRes.ok()) continue;
    const filesJson = (await filesRes.json()) as { count?: number; files?: unknown[] };
    const fileCount = filesJson.count ?? filesJson.files?.length ?? 0;
    if (fileCount < 1) continue;
    const row: GeneratedProjectCandidate = {
      id: p.id,
      name: p.app_name ?? p.name ?? "generated",
      fileCount,
      shortDescription: p.short_description ?? p.description ?? null,
    };
    if (!best || fileCount > best.fileCount) best = row;
  }

  if (best) writeCache(best);
  return best ?? readCache();
}
