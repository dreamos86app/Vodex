import { supabase } from "./supabase.js";
import { log } from "./logger.js";

function operationId(projectId: string): string {
  return `zip-preview:${projectId}`;
}

export async function captureZipPreviewCredits(projectId: string, ownerId: string): Promise<void> {
  const op = operationId(projectId);
  const { data: hold } = await supabase
    .from("zip_preview_action_holds")
    .select("credits, status")
    .eq("operation_id", op)
    .maybeSingle();

  if (!hold || hold.status === "charged" || hold.status === "cancelled" || hold.status === "refunded") {
    return;
  }

  const credits = Number(hold.credits) || 10;
  const { data, error } = await supabase.rpc("charge_action_credits", {
    p_owner_user_id: ownerId,
    p_project_id: null,
    p_action_type: "zip_preview_build",
    p_credits: credits,
    p_operation_id: op,
    p_provider: "preview_worker",
    p_provider_cost_usd: 0,
    p_metadata: { zip_preview: true, capture: true },
  });

  if (error) {
    log("error", "zip preview charge failed", { projectId, error: error.message });
    return;
  }

  const row = data as { success?: boolean } | null;
  if (row?.success) {
    await supabase
      .from("zip_preview_action_holds")
      .update({ status: "charged", updated_at: new Date().toISOString() })
      .eq("operation_id", op);
    log("info", "zip preview credits captured", { projectId, credits });
  }
}

export async function cancelZipPreviewHold(projectId: string): Promise<void> {
  const op = operationId(projectId);
  await supabase
    .from("zip_preview_action_holds")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("operation_id", op)
    .eq("status", "reserved");
}
