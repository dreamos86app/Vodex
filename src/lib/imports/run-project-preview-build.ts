import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProjectFilesWithContent } from "@/lib/preview/project-preview-html";
import { runImportPreviewBuild } from "@/lib/imports/runtime-build-runner";
import { applyPreviewBuildToProject } from "@/lib/imports/apply-preview-build-to-project";
import { repairImportedThinFiles } from "@/lib/imports/repair-imported-thin-files";
import { persistRepairedImportFiles } from "@/lib/imports/persist-repaired-import-files";
import { applyZipAutoRepair } from "@/lib/imports/apply-zip-auto-repair";
import type { ZipPreviewCreditEstimate } from "@/lib/imports/zip-preview-action-credits";
import { previewZipBillingDiagnostics } from "@/lib/imports/zip-preview-billing";

export async function runProjectPreviewBuild(input: {
  admin: SupabaseClient;
  writer: SupabaseClient;
  userId: string;
  projectId: string;
  creditEstimate?: ZipPreviewCreditEstimate;
}) {
  const files = await loadProjectFilesWithContent(input.writer, input.projectId);
  let zipFiles = files.map((f) => ({
    path: f.path,
    content: f.content,
    sizeBytes: Buffer.byteLength(f.content, "utf8"),
  }));

  const repaired = repairImportedThinFiles(zipFiles);
  if (repaired.repairedPaths.length > 0) {
    zipFiles = repaired.files;
    await persistRepairedImportFiles({
      admin: input.admin,
      projectId: input.projectId,
      ownerId: input.userId,
      files: zipFiles,
      repairedPaths: repaired.repairedPaths,
    });
  }

  const autoRepair = await applyZipAutoRepair({
    admin: input.admin,
    writer: input.writer,
    projectId: input.projectId,
    ownerId: input.userId,
    files: zipFiles,
  });
  zipFiles = autoRepair.repairedFiles;

  const previewBilling = input.creditEstimate
    ? previewZipBillingDiagnostics(input.creditEstimate, "reserved")
    : undefined;

  const repairStatusMessage =
    autoRepair.repairActions.length > 0 && autoRepair.canBuild
      ? "Auto-repair applied — rebuilding preview"
      : null;

  const { diagnostics, jobId } = await runImportPreviewBuild({
    admin: input.admin,
    userId: input.userId,
    projectId: input.projectId,
    files: zipFiles,
    previewBilling,
  });

  const mergedDiagnostics = repairStatusMessage
    ? {
        ...diagnostics,
        userMessage: repairStatusMessage,
        warnings: [
          ...diagnostics.warnings,
          `ZIP auto-repair: ${autoRepair.repairActions.length} file(s) normalized`,
        ],
      }
    : diagnostics;

  await applyPreviewBuildToProject({
    writer: input.writer,
    projectId: input.projectId,
    userId: input.userId,
    diagnostics: mergedDiagnostics,
  });
  return { diagnostics: mergedDiagnostics, jobId, autoRepair };
}
