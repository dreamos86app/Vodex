import type { createSupabaseAdmin } from "@/lib/supabase/admin";

/** User-level action pool (`project_id IS NULL`) — max balance if duplicate rows exist. */
export async function batchUserLevelActionBalances(
  admin: ReturnType<typeof createSupabaseAdmin>,
  userIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (userIds.length === 0) return map;

  const { data } = await admin
    .from("action_credit_balances" as never)
    .select("owner_user_id, balance, project_id")
    .in("owner_user_id" as never, userIds);

  for (const row of (data ?? []) as Array<{
    owner_user_id: string;
    balance?: number;
    project_id?: string | null;
  }>) {
    if (row.project_id != null && row.project_id !== "") continue;
    const bal = typeof row.balance === "number" ? row.balance : Number(row.balance) || 0;
    const prev = map.get(row.owner_user_id);
    if (prev == null || bal > prev) {
      map.set(row.owner_user_id, bal);
    }
  }
  return map;
}
