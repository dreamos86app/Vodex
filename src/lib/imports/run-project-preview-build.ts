import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProjectFilesWithContent } from "@/lib/preview/project-preview-html";
import { runImportPreviewBuild } from "@/lib/imports/runtime-build-runner";
import { applyPreviewBuildToProject } from "@/lib/imports/apply-preview-build-to-project";
import { repairImportedThinFiles } from "@/lib/imports/repair-imported-thin-files";
import { persistRepairedImportFiles } from "@/lib/imports/persist-repaired-import-files";
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

  const previewBilling = input.creditEstimate
    ? previewZipBillingDiagnostics(input.creditEstimate, "reserved")
    : undefined;

  const { diagnostics, jobId } = await runImportPreviewBuild({
    admin: input.admin,
    userId: input.userId,
    projectId: input.projectId,
    files: zipFiles,
    previewBilling,
  });
  await applyPreviewBuildToProject({
    writer: input.writer,
    projectId: input.projectId,
    userId: input.userId,
    diagnostics,
  });
  return { diagnostics, jobId };
}
