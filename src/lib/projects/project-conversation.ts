import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Writer = SupabaseClient<Database>;

export type EnsureProjectConversationInput = {
  writer: Writer;
  user: User;
  conversationId?: string;
  projectId?: string;
  title: string;
  modelId: string;
  mode?: "discuss" | "edit" | "build";
};

export type EnsureProjectConversationResult =
  | { id: string }
  | { error: string; status: number; code: string; hint?: string };

/**
 * One primary conversation per project: lookup by project_id, backfill links, or create.
 */
export async function ensureProjectConversation(
  input: EnsureProjectConversationInput,
): Promise<EnsureProjectConversationResult> {
  const { writer, user, title, modelId } = input;
  const projectId = input.projectId?.trim() || undefined;
  const mode = input.mode ?? "discuss";

  if (input.conversationId) {
    const { data, error } = await writer
      .from("conversations")
      .select("id, project_id")
      .eq("id", input.conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return {
        error: error.message,
        status: 500,
        code: "conversation_error",
        hint: "Check Supabase migrations for public.conversations.",
      };
    }
    if (!data?.id) {
      return {
        error: "Conversation not found",
        status: 404,
        code: "conversation_error",
        hint: "Start a new thread or reopen this project.",
      };
    }

    if (projectId && !data.project_id) {
      await writer
        .from("conversations")
        .update({ project_id: projectId, mode } as never)
        .eq("id", data.id)
        .eq("user_id", user.id);
    }

    return { id: data.id };
  }

  if (projectId) {
    const { data: existing, error: lookupErr } = await writer
      .from("conversations")
      .select("id")
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupErr?.message?.includes("project_id")) {
      /* column missing — fall through to insert */
    } else if (existing?.id) {
      return { id: existing.id };
    }
  }

  const row: Record<string, unknown> = {
    user_id: user.id,
    title: title.slice(0, 80) || "New conversation",
    model_id: modelId,
  };
  if (projectId) row.project_id = projectId;
  row.mode = mode;

  const { data, error } = await writer
    .from("conversations")
    .insert(row as never)
    .select("id")
    .single();

  if (error || !data?.id) {
    const slim = {
      user_id: user.id,
      title: title.slice(0, 80) || "New conversation",
      model_id: modelId,
      project_id: null,
      mode: null,
    };
    const retry = await writer.from("conversations").insert(slim).select("id").single();
    if (retry.error || !retry.data?.id) {
      return {
        error: error?.message ?? retry.error?.message ?? "Could not create conversation",
        status: 500,
        code: "conversation_error",
      };
    }
    return { id: retry.data.id };
  }

  return { id: data.id };
}

/** Load conversation id for a project (client or server). */
export async function findProjectConversationId(
  writer: Writer,
  userId: string,
  projectId: string,
): Promise<string | null> {
  const { data, error } = await writer
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error?.message?.includes("project_id")) return null;
  return data?.id ?? null;
}
