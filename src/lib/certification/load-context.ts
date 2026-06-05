import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadCertificationProjectFiles } from "@/lib/certification/load-project-files";
import type { CertificationContext } from "@/lib/certification/types";
import { isZipImportProject } from "@/lib/projects/imported-project-state";

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

  const { data: pub } = await admin
    .from("published_apps" as never)
    .select("slug, public_url, canonical_url, status, snapshot_files")
    .eq("project_id", projectId)
    .eq("status", "published")
    .maybeSingle();

  const pubRowEarly = pub as { snapshot_files?: unknown } | null;
  const files = await loadCertificationProjectFiles(admin, projectId, {
    publishedSnapshot: pubRowEarly?.snapshot_files,
  });

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
