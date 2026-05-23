import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Writer = SupabaseClient<Database>;

export type CreditEventStatus = "pending" | "finalized" | "failed" | "refunded";

export type WriteCreditEventInput = {
  userId: string;
  operationId: string;
  modelId?: string | null;
  creditsConsumed: number;
  providerCostUsd?: number;
  eventType?: Database["public"]["Tables"]["credit_events"]["Row"]["event_type"];
  status?: CreditEventStatus;
  projectId?: string | null;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
};

/** Never writes null credits_consumed — uses 0 for pending/failed/free paths. */
export async function writeCreditEvent(
  writer: Writer,
  input: WriteCreditEventInput,
): Promise<{ ok: boolean; error?: string }> {
  const credits = Number.isFinite(input.creditsConsumed) ? Math.max(0, Math.round(input.creditsConsumed)) : 0;
  const modelId = (input.modelId?.trim() || "unknown").slice(0, 120);
  const operationId = input.operationId?.trim();
  if (!operationId) {
    return { ok: false, error: "missing_operation_id" };
  }

  const row: Record<string, unknown> = {
    user_id: input.userId,
    operation_id: operationId,
    model_id: modelId,
    credits_consumed: credits,
    provider_cost_usd: input.providerCostUsd ?? 0,
    internal_cost_usd: input.providerCostUsd ?? 0,
    event_type: input.eventType ?? (credits > 0 ? "generation" : "generation"),
    project_id: input.projectId ?? null,
    conversation_id: input.conversationId ?? null,
    metadata: {
      status: input.status ?? (credits > 0 ? "finalized" : "failed"),
      provider_cost_usd: input.providerCostUsd ?? 0,
      ...input.metadata,
    },
  };

  const { error } = await writer.from("credit_events").insert(row as never);
  if (error) {
    if (/duplicate|unique|already exists/i.test(error.message)) {
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
