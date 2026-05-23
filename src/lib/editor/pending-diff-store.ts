import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import type { FileDiff } from "@/lib/editor/diff";

export type PendingDiffRecord = {
  id: string;
  projectId: string;
  status: "pending" | "applied" | "rejected" | "failed";
  summary: string;
  diffs: FileDiff[];
  generationId: string | null;
  quoteId: string | null;
  checkpointId: string | null;
  createdAt: string;
};

type Writer = SupabaseClient<Database>;

function metaFallback(projectMeta: Record<string, unknown>): PendingDiffRecord | null {
  const pd = projectMeta.pending_diff as PendingDiffRecord | undefined;
  return pd?.status === "pending" ? pd : null;
}

export async function getPendingDiff(
  writer: Writer,
  userId: string,
  projectId: string,
): Promise<PendingDiffRecord | null> {
  const { data, error } = await (writer as SupabaseClient)
    .from("pending_diffs" as never)
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data) {
    const row = data as {
      id: string;
      project_id: string;
      status: string;
      summary: string | null;
      changed_files: FileDiff[];
      generation_id: string | null;
      quote_id: string | null;
      checkpoint_id: string | null;
      created_at: string;
    };
    return {
      id: row.id,
      projectId: row.project_id,
      status: row.status as PendingDiffRecord["status"],
      summary: row.summary ?? "",
      diffs: row.changed_files ?? [],
      generationId: row.generation_id,
      quoteId: row.quote_id,
      checkpointId: row.checkpoint_id,
      createdAt: row.created_at,
    };
  }

  const { data: proj } = await writer
    .from("projects")
    .select("metadata")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();

  const meta = (proj?.metadata ?? {}) as Record<string, unknown>;
  return metaFallback(meta);
}

export async function savePendingDiff(
  writer: Writer,
  input: {
    userId: string;
    projectId: string;
    conversationId?: string | null;
    summary: string;
    diffs: FileDiff[];
    generationId: string;
    quoteId?: string | null;
    checkpointId?: string | null;
  },
): Promise<PendingDiffRecord> {
  const row = {
    user_id: input.userId,
    project_id: input.projectId,
    conversation_id: input.conversationId ?? null,
    status: "pending",
    summary: input.summary,
    changed_files: input.diffs as unknown as Json,
    generation_id: input.generationId,
    quote_id: input.quoteId ?? null,
    checkpoint_id: input.checkpointId ?? null,
    metadata: { source: "chat_edit" } as Json,
    updated_at: new Date().toISOString(),
  };

  await (writer as SupabaseClient)
    .from("pending_diffs" as never)
    .update({ status: "rejected" } as never)
    .eq("project_id", input.projectId)
    .eq("user_id", input.userId)
    .eq("status", "pending")
    .then(() => undefined, () => undefined);

  const { data: inserted, error } = await (writer as SupabaseClient)
    .from("pending_diffs" as never)
    .insert(row as never)
    .select("id, created_at")
    .single();

  const ins = inserted as { id?: string; created_at?: string } | null;
  const record: PendingDiffRecord = {
    id: ins?.id ?? input.generationId,
    projectId: input.projectId,
    status: "pending",
    summary: input.summary,
    diffs: input.diffs,
    generationId: input.generationId,
    quoteId: input.quoteId ?? null,
    checkpointId: input.checkpointId ?? null,
    createdAt: ins?.created_at ?? new Date().toISOString(),
  };

  if (error) {
    const { data: proj } = await writer
      .from("projects")
      .select("metadata")
      .eq("id", input.projectId)
      .eq("owner_id", input.userId)
      .maybeSingle();
    const meta = (proj?.metadata ?? {}) as Record<string, unknown>;
    await writer
      .from("projects")
      .update({ metadata: { ...meta, pending_diff: record } } as never)
      .eq("id", input.projectId)
      .eq("owner_id", input.userId);
  }

  return record;
}

export async function updatePendingDiffFiles(
  writer: Writer,
  userId: string,
  projectId: string,
  diffId: string,
  diffs: FileDiff[],
): Promise<void> {
  await (writer as SupabaseClient)
    .from("pending_diffs" as never)
    .update({ changed_files: diffs as unknown as Json, updated_at: new Date().toISOString() } as never)
    .eq("id", diffId)
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .then(() => undefined, () => undefined);

  const { data: proj } = await writer
    .from("projects")
    .select("metadata")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();
  const meta = (proj?.metadata ?? {}) as Record<string, unknown>;
  if (meta.pending_diff && (meta.pending_diff as PendingDiffRecord).id === diffId) {
    await writer
      .from("projects")
      .update({
        metadata: {
          ...meta,
          pending_diff: { ...(meta.pending_diff as PendingDiffRecord), diffs },
        },
      } as never)
      .eq("id", projectId)
      .eq("owner_id", userId);
  }
}

export async function updatePendingDiffStatus(
  writer: Writer,
  userId: string,
  projectId: string,
  diffId: string,
  status: "applied" | "rejected" | "failed",
): Promise<void> {
  await (writer as SupabaseClient)
    .from("pending_diffs" as never)
    .update({ status, updated_at: new Date().toISOString() } as never)
    .eq("id", diffId)
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .then(() => undefined, () => undefined);

  const { data: proj } = await writer
    .from("projects")
    .select("metadata")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();
  const meta = (proj?.metadata ?? {}) as Record<string, unknown>;
  if (meta.pending_diff && (meta.pending_diff as PendingDiffRecord).id === diffId) {
    await writer
      .from("projects")
      .update({
        metadata: {
          ...meta,
          pending_diff: { ...(meta.pending_diff as PendingDiffRecord), status },
        },
      } as never)
      .eq("id", projectId)
      .eq("owner_id", userId);
  }
}
