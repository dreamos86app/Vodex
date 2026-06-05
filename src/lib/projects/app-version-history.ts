import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AppVersionRow = {
  id: string;
  project_id: string;
  owner_id: string;
  workspace_id: string | null;
  version_number: number;
  summary: string | null;
  mode: string | null;
  credit_cost: number | null;
  changed_paths: string[] | null;
  created_by: string | null;
  created_at: string;
};

export async function listAppVersions(
  admin: SupabaseClient,
  projectId: string,
  limit = 30,
): Promise<AppVersionRow[]> {
  const { data } = await admin
    .from("app_versions" as never)
    .select("*")
    .eq("project_id" as never, projectId)
    .order("version_number", { ascending: false })
    .limit(limit);
  return (data ?? []) as AppVersionRow[];
}

export async function saveAppVersionSnapshot(input: {
  admin: SupabaseClient;
  projectId: string;
  ownerId: string;
  workspaceId?: string | null;
  createdBy: string;
  mode: string;
  summary: string;
  creditCost?: number;
  files: Array<{ path: string; content: string }>;
  changedPaths?: string[];
}): Promise<{ versionId: string; versionNumber: number } | null> {
  const { data: latest } = await input.admin
    .from("app_versions" as never)
    .select("version_number")
    .eq("project_id" as never, input.projectId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestNum = (latest as { version_number?: number } | null)?.version_number;
  const versionNumber = typeof latestNum === "number" ? latestNum + 1 : 1;

  const changed =
    input.changedPaths ??
    input.files.map((f) => f.path).filter(Boolean).slice(0, 200);

  const { data: version, error } = await input.admin
    .from("app_versions" as never)
    .insert({
      project_id: input.projectId,
      owner_id: input.ownerId,
      workspace_id: input.workspaceId ?? null,
      version_number: versionNumber,
      summary: input.summary,
      mode: input.mode,
      credit_cost: input.creditCost ?? 0,
      changed_paths: changed,
      created_by: input.createdBy,
    } as never)
    .select("id, version_number")
    .single();

  if (error || !version) return null;

  const versionId = (version as { id: string }).id;
  const rows = input.files.map((f) => ({
    version_id: versionId,
    path: f.path,
    content: f.content,
  }));

  if (rows.length > 0) {
    await input.admin.from("app_version_files" as never).insert(rows as never);
  }

  return { versionId, versionNumber };
}

export async function restoreAppVersion(input: {
  admin: SupabaseClient;
  projectId: string;
  ownerId: string;
  workspaceId?: string | null;
  versionId: string;
  restoredBy: string;
}): Promise<{ ok: boolean; error?: string; newVersionNumber?: number }> {
  const { data: version } = await input.admin
    .from("app_versions" as never)
    .select("id, project_id, owner_id, mode, summary, credit_cost")
    .eq("id" as never, input.versionId)
    .eq("project_id" as never, input.projectId)
    .eq("owner_id" as never, input.ownerId)
    .maybeSingle();

  if (!version) return { ok: false, error: "version_not_found" };

  const { data: files } = await input.admin
    .from("app_version_files" as never)
    .select("path, content")
    .eq("version_id" as never, input.versionId);

  const fileRows = (files ?? []) as Array<{ path: string; content: string }>;
  if (!fileRows.length) return { ok: false, error: "version_empty" };

  for (const file of fileRows) {
    await input.admin.from("app_files").upsert(
      {
        project_id: input.projectId,
        path: file.path,
        content: file.content,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "project_id,path" },
    );
  }

  const saved = await saveAppVersionSnapshot({
    admin: input.admin,
    projectId: input.projectId,
    ownerId: input.ownerId,
    workspaceId: input.workspaceId,
    createdBy: input.restoredBy,
    mode: (version as { mode?: string }).mode ?? "restore",
    summary: `Restored from version ${input.versionId.slice(0, 8)}`,
    creditCost: 0,
    files: fileRows,
    changedPaths: fileRows.map((f) => f.path),
  });

  return { ok: true, newVersionNumber: saved?.versionNumber };
}
