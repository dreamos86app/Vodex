import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Server-only: verify caller owns project before runtime operations. */
export async function assertProjectOwnerScope(
  supabase: SupabaseClient<Database>,
  projectId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!projectId?.trim() || !userId?.trim()) {
    return { ok: false, error: "Missing project or user scope" };
  }
  const { data, error } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data || data.owner_id !== userId) {
    return { ok: false, error: "Project access denied" };
  }
  return { ok: true };
}

/** Never trust client-supplied owner_id — always use session user. */
export function rejectClientOwnerId(bodyOwnerId: unknown, sessionUserId: string): boolean {
  if (bodyOwnerId == null || bodyOwnerId === "") return false;
  return String(bodyOwnerId) !== sessionUserId;
}
