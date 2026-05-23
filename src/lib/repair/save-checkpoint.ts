import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createCheckpoint } from "@/lib/editor/checkpoints";

type Writer = SupabaseClient<Database>;

export async function saveProjectCheckpoint(
  writer: Writer,
  projectId: string,
  userId: string,
  label: string,
  files: Array<{ path: string; content: string }>,
  stage: "pre_build" | "post_stage" | "manual" = "manual",
): Promise<string | null> {
  const cp = createCheckpoint({ projectId, label, stage, files });
  const { data: proj } = await writer
    .from("projects")
    .select("metadata")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();

  const meta = (proj?.metadata ?? {}) as Record<string, unknown>;
  const list = Array.isArray(meta.editor_checkpoints) ? meta.editor_checkpoints : [];
  const next = [cp, ...list].slice(0, 20);
  const { error } = await writer
    .from("projects")
    .update({ metadata: { ...meta, editor_checkpoints: next } as never })
    .eq("id", projectId)
    .eq("owner_id", userId);

  if (error) return null;
  return cp.id;
}
