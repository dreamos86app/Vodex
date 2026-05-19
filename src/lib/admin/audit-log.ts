import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

export async function logAdminAudit(
  admin: { id: string },
  actionType: string,
  opts: {
    targetUserId: string;
    amount?: number | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const db = createSupabaseAdmin();
    await db.from("admin_actions").insert({
      admin_id: admin.id,
      target_id: opts.targetUserId,
      action_type: actionType,
      amount: opts.amount ?? null,
      reason: opts.reason ?? null,
      otp_verified: false,
      metadata: (opts.metadata ?? {}) as Json,
    });
  } catch {
    /* non-fatal if table unavailable */
  }
}
