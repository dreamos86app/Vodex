import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZipImportFile } from "@/lib/import/zip-file-validator";
import {
  runZipAutoRepairEngine,
  zipAutoRepairMetadata,
} from "@/lib/imports/zip-auto-repair-engine";
import { persistRepairedImportFiles } from "@/lib/imports/persist-repaired-import-files";
import type { Json } from "@/lib/supabase/types";

export type ApplyZipAutoRepairResult = ReturnType<typeof runZipAutoRepairEngine> & {
  persisted: number;
};

/** Run ZIP auto-repair, persist changed files, merge metadata.zip_auto_repair on project. */
export async function applyZipAutoRepair(input: {
  admin: SupabaseClient;
  writer: SupabaseClient;
  projectId: string;
  ownerId: string;
  files: ZipImportFile[];
  persist?: boolean;
  mergeMetadata?: boolean;
}): Promise<ApplyZipAutoRepairResult> {
  const repair = runZipAutoRepairEngine(input.files);
  let persisted = 0;

  if (input.persist !== false && repair.modifiedPaths.length > 0) {
    const persist = await persistRepairedImportFiles({
      admin: input.admin,
      projectId: input.projectId,
      ownerId: input.ownerId,
      files: repair.repairedFiles,
      repairedPaths: repair.modifiedPaths,
    });
    if (persist.ok) persisted = persist.updated;
  }

  if (input.mergeMetadata !== false) {
    const { data: row } = await input.writer
      .from("projects")
      .select("metadata")
      .eq("id", input.projectId)
      .maybeSingle();
    const prev =
      row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    await input.writer
      .from("projects")
      .update({
        metadata: {
          ...prev,
          zip_auto_repair: zipAutoRepairMetadata(repair),
        } as Json,
      } as never)
      .eq("id", input.projectId);
  }

  return { ...repair, persisted };
}
