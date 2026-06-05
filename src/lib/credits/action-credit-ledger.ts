import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type LedgerEntry = {
  id: string;
  action_type: string;
  amount: number;
  status: string;
  project_id: string | null;
  operation_id: string | null;
  created_at: string;
  meta: Record<string, unknown>;
};

/** Read recent action credit ledger rows for a user/project (server routes only). */
export async function listActionCreditLedger(input: {
  userId: string;
  projectId?: string;
  limit?: number;
}): Promise<LedgerEntry[]> {
  const admin = createSupabaseAdmin();
  if (!admin) return [];

  let q = admin
    .from("action_credit_ledger" as never)
    .select("id, action_type, amount, status, project_id, operation_id, created_at, meta")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 50);

  if (input.projectId) {
    q = q.eq("project_id", input.projectId);
  }

  const { data } = await q;
  return (data ?? []) as LedgerEntry[];
}
