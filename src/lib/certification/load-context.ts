import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { CertificationContext } from "@/lib/certification/types";
import { isZipImportProject } from "@/lib/projects/imported-project-state";

const MAX_FILES = 250;
const MAX_BYTES = 4_000_000;

export async function loadCertificationContext(
  projectId: string,
  ownerId: string,
): Promise<CertificationContext | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data: project } = await admin
    .from("projects")
    .select("id, name, metadata, status")
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!project) return null;

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const { data: fileRows } = await admin
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId)
    .order("path")
    .limit(MAX_FILES);

  const files: Array<{ path: string; content: string }> = [];
  let bytes = 0;
  for (const row of fileRows ?? []) {
    const content = String(row.content ?? "");
    bytes += content.length;
    if (bytes > MAX_BYTES) break;
    files.push({ path: String(row.path), content });
  }

  const { data: pub } = await admin
    .from("published_apps" as never)
    .select("slug, public_url, canonical_url, status")
    .eq("project_id", projectId)
    .eq("status", "published")
    .maybeSingle();

  const published = Boolean(pub);
  const pubRow = pub as { slug?: string; public_url?: string; canonical_url?: string } | null;
  const publishedUrl =
    pubRow?.public_url?.trim() ||
    pubRow?.canonical_url?.trim() ||
    null;

  return {
    projectId,
    ownerId,
    projectName: project.name,
    metadata: meta,
    files,
    published,
    publishedSlug: pubRow?.slug ?? null,
    publishedUrl,
  };
}

export function detectAppSourceKind(metadata: Record<string, unknown>): string {
  if (isZipImportProject(metadata)) return "zip_import";
  if (metadata.import_source === "base44") return "base44_import";
  if (metadata.import_source === "lovable") return "lovable_import";
  if (metadata.import_source === "replit") return "replit_import";
  if (metadata.generated_by === "ai") return "ai_generated";
  return "vodex_app";
}
