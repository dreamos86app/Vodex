import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { detectEditIntent } from "@/lib/editor/detect-edit-intent";
import { generateEditDiffPlan } from "@/lib/editor/generate-edit-diff";
import { savePendingDiff } from "@/lib/editor/pending-diff-store";
import {
  reserveCreditsForGeneration,
  reconcileGenerationReservation,
} from "@/lib/billing/credit-reservations";
import { routeModel } from "@/lib/ai/model-router";
import { loadProfileBillingRow } from "@/lib/supabase/load-profile-billing";

type Writer = SupabaseClient<Database>;

export async function maybeCreatePendingDiffFromChatEdit(input: {
  writer: Writer;
  supabase: SupabaseClient<Database>;
  userId: string;
  userEmail: string | null;
  projectId: string;
  conversationId?: string;
  userPrompt: string;
  mode: "discuss" | "edit" | "build";
}): Promise<{ created: boolean; summary?: string }> {
  if (input.mode !== "edit" || !detectEditIntent(input.userPrompt)) {
    return { created: false };
  }

  const { data: files } = await input.writer
    .from("app_files")
    .select("path, content")
    .eq("project_id", input.projectId);
  const fileList = (files ?? [])
    .filter((f) => f.path && f.content != null)
    .map((f) => ({ path: f.path!, content: f.content! }));
  if (fileList.length === 0) return { created: false };

  const { row: billing } = await loadProfileBillingRow(input.supabase, {
    id: input.userId,
    email: input.userEmail,
  } as User);
  const balance = billing?.credits_remaining ?? 0;
  const routed = routeModel("edit");
  const operationId = `edit-diff:${input.userId}:${input.projectId}:${Date.now()}`;

  const reserve = await reserveCreditsForGeneration(input.writer, {
    userId: input.userId,
    userEmail: input.userEmail ?? "",
    generationId: operationId,
    projectId: input.projectId,
    conversationId: input.conversationId,
    balance,
    mode: "edit",
    selectedModel: routed.modelId,
    complexity: 5,
    expectedFiles: Math.min(fileList.length, 6),
    promptLength: input.userPrompt.length,
    userPlan: billing?.plan_id ?? null,
  });

  if (!reserve.ok) return { created: false };

  const plan = await generateEditDiffPlan({
    writer: input.writer,
    userId: input.userId,
    userEmail: input.userEmail,
    operationId,
    projectId: input.projectId,
    userPrompt: input.userPrompt,
    files: fileList,
  });

  const actualCredits = plan.ok ? reserve.quote?.userCreditsRequired ?? 4 : 0;
  await reconcileGenerationReservation(input.writer, {
    userId: input.userId,
    generationId: operationId,
    reservedCredits: reserve.reserved,
    actualUserCredits: actualCredits,
    providerCostUsd: plan.providerCostUsd,
    success: plan.ok,
    projectId: input.projectId,
  });

  if (!plan.ok || plan.diffs.length === 0) return { created: false };

  await savePendingDiff(input.writer, {
    userId: input.userId,
    projectId: input.projectId,
    conversationId: input.conversationId,
    summary: plan.summary,
    diffs: plan.diffs,
    generationId: operationId,
    quoteId: reserve.reservationId,
  });

  return { created: true, summary: plan.summary };
}
