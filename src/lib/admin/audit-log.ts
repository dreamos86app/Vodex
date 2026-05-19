import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

export async function logAdminAudit(
  admin: { id: string },
  action: string,
  opts: {
    targetUserId?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    amount?: number | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
    request?: Request;
  },
): Promise<void> {
  const ip =
    opts.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    opts.request?.headers.get("x-real-ip") ??
    null;
  const userAgent = opts.request?.headers.get("user-agent") ?? null;

  try {
    const db = createSupabaseAdmin();

    await db.from("admin_audit_logs").insert({
      admin_user_id: admin.id,
      action,
      target_user_id: opts.targetUserId ?? null,
      before_state: (opts.before ?? null) as Json,
      after_state: (opts.after ?? null) as Json,
      ip_address: ip,
      user_agent: userAgent,
      metadata: {
        ...(opts.metadata ?? {}),
        amount: opts.amount ?? undefined,
        reason: opts.reason ?? undefined,
      } as Json,
    });

    if (opts.targetUserId) {
      await db.from("admin_actions").insert({
        admin_id: admin.id,
        target_id: opts.targetUserId,
        action_type: action,
        amount: opts.amount ?? null,
        reason: opts.reason ?? null,
        otp_verified: false,
        metadata: (opts.metadata ?? {}) as Json,
      });
    }
  } catch {
    /* non-fatal if tables unavailable */
  }
}
