import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

export type SecurityAuditAction =
  | "publish"
  | "unpublish"
  | "deploy"
  | "credit_charge"
  | "credit_refund"
  | "lifecycle_override"
  | "repair"
  | "project_archive"
  | "project_delete";

function requestMeta(request?: Request): { ip: string | null; userAgent: string | null } {
  if (!request) return { ip: null, userAgent: null };
  return {
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null,
    userAgent: request.headers.get("user-agent"),
  };
}

/** Immutable security audit trail for paid-user critical events. */
export async function logSecurityAudit(input: {
  userId: string;
  action: SecurityAuditAction | string;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
  request?: Request;
}): Promise<void> {
  const { ip, userAgent } = requestMeta(input.request);
  try {
    const db = createSupabaseAdmin();
    await db.from("admin_audit_logs").insert({
      admin_user_id: input.userId,
      action: input.action,
      target_user_id: input.userId,
      before_state: null,
      after_state: null,
      metadata: {
        ...(input.metadata ?? {}),
        project_id: input.projectId ?? undefined,
        source: "security_audit",
      } as Json,
      ip_address: ip,
      user_agent: userAgent,
    } as never);
  } catch {
    /* non-fatal if audit table unavailable */
  }
}
