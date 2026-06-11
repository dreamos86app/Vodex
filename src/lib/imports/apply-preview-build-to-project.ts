import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportPreviewDiagnostics } from "@/lib/imports/import-diagnostics";
import { importPreviewArtifactBinaryAssets } from "@/lib/import/import-zip-binary-assets";
import { lifecyclePatch } from "@/lib/projects/project-lifecycle";
import {
  canonicalPreviewRuntimeUrl,
  tryNormalizeInternalPreviewUrl,
} from "@/lib/preview/internal-preview-url";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function applyPreviewBuildToProject(input: {
  writer: SupabaseClient;
  projectId: string;
  userId: string;
  diagnostics: ImportPreviewDiagnostics;
}): Promise<void> {
  const { data: project } = await input.writer
    .from("projects")
    .select("metadata")
    .eq("id", input.projectId)
    .eq("owner_id", input.userId)
    .maybeSingle();

  const prevMeta =
    project?.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const isQueued = input.diagnostics.previewStatus === "queued";
  const lifecycleStatus = input.diagnostics.previewRenderable
    ? "imported_preview_ready"
    : isQueued
      ? "imported"
      : "imported";

  const importMeta =
    prevMeta.import && typeof prevMeta.import === "object"
      ? (prevMeta.import as Record<string, unknown>)
      : {};

  const normalizedPreviewUrl = input.diagnostics.previewRenderable
    ? input.diagnostics.jobId
      ? canonicalPreviewRuntimeUrl(input.projectId, input.diagnostics.jobId)
      : tryNormalizeInternalPreviewUrl(input.diagnostics.previewUrl)
    : null;

  await input.writer
    .from("projects")
    .update({
      preview_url: normalizedPreviewUrl,
      metadata: {
        ...prevMeta,
        ...lifecyclePatch(lifecycleStatus),
        imported_framework: input.diagnostics.framework,
        import_status: input.diagnostics.previewStatus,
        preview_status: input.diagnostics.previewStatus,
        preview_job_id: input.diagnostics.jobId,
        preview_worker_queued: isQueued,
        preview_url: normalizedPreviewUrl,
        preview_artifact_path: input.diagnostics.artifactPath,
        preview_blocked_reason: input.diagnostics.blockedReason,
        preview_diagnostics: input.diagnostics,
        preview_renderable: input.diagnostics.previewRenderable,
        source_integrity_ok: input.diagnostics.sourceIntegrityOk,
        last_preview_build_at: input.diagnostics.lastPreviewBuildAt,
        preview_ready: input.diagnostics.previewRenderable,
        preview_honest:
          input.diagnostics.previewRenderable &&
          input.diagnostics.previewStatus !== "queued",
        import: {
          ...importMeta,
          framework: {
            id: input.diagnostics.framework,
            label: input.diagnostics.frameworkLabel,
          },
          preview_ready: input.diagnostics.previewRenderable,
          publish_ready: input.diagnostics.previewRenderable && input.diagnostics.sourceIntegrityOk,
          legacy_platform: input.diagnostics.legacyPlatform,
          warnings: input.diagnostics.warnings,
          blockers: input.diagnostics.blockers,
          entry_file: input.diagnostics.entryFiles[0] ?? importMeta.entry_file,
        },
        import_validation: input.diagnostics,
      },
    } as never)
    .eq("id", input.projectId)
    .eq("owner_id", input.userId);

  if (input.diagnostics.previewRenderable && input.diagnostics.artifactPath) {
    const admin = createSupabaseAdmin();
    if (admin) {
      await importPreviewArtifactBinaryAssets({
        admin,
        userId: input.userId,
        projectId: input.projectId,
        artifactPath: input.diagnostics.artifactPath,
      });
    }
  }
}
