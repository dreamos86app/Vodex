import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type WorkspaceBillingMode =
  | "personal_credits"
  | "workspace_sponsored"
  | "hybrid";

export type BilledToType = "personal" | "workspace";

export type CreditBillingTarget = {
  actorUserId: string;
  billedUserId: string;
  billedToType: BilledToType;
  billingMode: WorkspaceBillingMode;
  workspaceId: string | null;
  projectId: string | null;
  workspaceOwnerId: string | null;
};

type Writer = SupabaseClient<Database>;

function normalizeMode(raw: string | null | undefined): WorkspaceBillingMode {
  if (raw === "workspace_sponsored" || raw === "hybrid") return raw;
  return "personal_credits";
}

export async function fetchProfileBalance(writer: Writer, userId: string): Promise<number> {
  const { data } = await writer
    .from("profiles")
    .select("credits_remaining")
    .eq("id", userId)
    .maybeSingle();
  return typeof data?.credits_remaining === "number" ? data.credits_remaining : 0;
}

export type ResolveCreditBillingInput = {
  actorUserId: string;
  projectId?: string | null;
  workspaceId?: string | null;
  /** Credits needed for affordability checks (hybrid). */
  requiredCredits?: number;
};

/**
 * Server-only: who pays for an AI action. Default = actor (never project owner by default).
 */
export async function resolveCreditBillingTarget(
  writer: Writer,
  input: ResolveCreditBillingInput,
): Promise<CreditBillingTarget> {
  const actorUserId = input.actorUserId;
  let workspaceId = input.workspaceId ?? null;
  let workspaceOwnerId: string | null = null;
  let billingMode: WorkspaceBillingMode = "personal_credits";
  const projectId = input.projectId ?? null;

  if (projectId) {
    const { data: project } = await writer
      .from("projects")
      .select("id, owner_id, workspace_id")
      .eq("id", projectId)
      .maybeSingle();

    if (project) {
      workspaceId = project.workspace_id ?? workspaceId;
      workspaceOwnerId = project.owner_id;

      // Collaborators always bill the app owner (prevents free-account credit bypass).
      if (project.owner_id && project.owner_id !== actorUserId) {
        return {
          actorUserId,
          billedUserId: project.owner_id,
          billedToType: "workspace",
          billingMode,
          workspaceId,
          projectId,
          workspaceOwnerId: project.owner_id,
        };
      }
    }
  }

  if (workspaceId) {
    const { data: ws } = await writer
      .from("workspaces")
      .select("id, owner_id, billing_mode")
      .eq("id", workspaceId)
      .maybeSingle();
    if (ws) {
      workspaceOwnerId = ws.owner_id;
      billingMode = normalizeMode(ws.billing_mode);
    }
  }

  const required = Math.max(0, Math.floor(input.requiredCredits ?? 0));
  const actorBalance = await fetchProfileBalance(writer, actorUserId);
  const ownerBalance =
    workspaceOwnerId && workspaceOwnerId !== actorUserId
      ? await fetchProfileBalance(writer, workspaceOwnerId)
      : 0;

  // Owner acting on own project — always personal
  if (!workspaceOwnerId || workspaceOwnerId === actorUserId) {
    return {
      actorUserId,
      billedUserId: actorUserId,
      billedToType: "personal",
      billingMode,
      workspaceId,
      projectId,
      workspaceOwnerId,
    };
  }

  if (billingMode === "workspace_sponsored") {
    return {
      actorUserId,
      billedUserId: workspaceOwnerId,
      billedToType: "workspace",
      billingMode,
      workspaceId,
      projectId,
      workspaceOwnerId,
    };
  }

  if (billingMode === "hybrid") {
    const actorCanPay = required <= 0 ? actorBalance > 0 : actorBalance >= required;
    if (actorCanPay) {
      return {
        actorUserId,
        billedUserId: actorUserId,
        billedToType: "personal",
        billingMode,
        workspaceId,
        projectId,
        workspaceOwnerId,
      };
    }
    const ownerCanPay = required <= 0 ? ownerBalance > 0 : ownerBalance >= required;
    if (ownerCanPay) {
      return {
        actorUserId,
        billedUserId: workspaceOwnerId,
        billedToType: "workspace",
        billingMode,
        workspaceId,
        projectId,
        workspaceOwnerId,
      };
    }
    return {
      actorUserId,
      billedUserId: actorUserId,
      billedToType: "personal",
      billingMode,
      workspaceId,
      projectId,
      workspaceOwnerId,
    };
  }

  // personal_credits (default)
  return {
    actorUserId,
    billedUserId: actorUserId,
    billedToType: "personal",
    billingMode,
    workspaceId,
    projectId,
    workspaceOwnerId,
  };
}

export function billingSourceLabel(target: CreditBillingTarget): string {
  if (target.billedToType === "workspace") {
    return "Workspace-sponsored credits";
  }
  if (target.billingMode === "hybrid" && target.billedUserId === target.actorUserId) {
    return "Your personal credits";
  }
  return "Your personal credits";
}
