import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadProfileBillingRow } from "@/lib/supabase/load-profile-billing";
import { resolveStageModel } from "@/lib/ai/model-cost-runtime";
import { requireAuthUser, requireMutationProjectId, isNextResponse } from "@/lib/ids/api-mutation-guard";
import { guardExpensiveRoute } from "@/lib/security/route-guard";
import {
  reserveCreditsForGeneration,
  reconcileGenerationReservation,
} from "@/lib/billing/credit-reservations";
import { quoteGenerationCost } from "@/lib/billing/credit-profit-guard";
import { generatePolishPatches } from "@/lib/build/polish-generate";
import { scoreAppQuality } from "@/lib/quality/app-quality-score";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  let body: { projectId?: string; confirm?: boolean; modelId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const authUser = guardExpensiveRoute(sessionUser, "polish", body as Record<string, unknown>);
  if (isNextResponse(authUser)) return authUser;

  const projectId = requireMutationProjectId(body.projectId);
  if (isNextResponse(projectId)) return projectId;

  const writer = createServiceRoleClient() ?? supabase;
  const { data: project } = await writer
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", authUser.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: files } = await writer
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId);
  const fileList = (files ?? [])
    .filter((f) => f.path && f.content != null)
    .map((f) => ({ path: f.path!, content: f.content! }));

  if (fileList.length === 0) {
    return NextResponse.json({ error: "No files to polish" }, { status: 400 });
  }

  const { row: billing } = await loadProfileBillingRow(supabase, authUser);
  const balance = billing?.credits_remaining ?? 0;
  const routed = resolveStageModel({
    stage: "repair",
    mode: "edit",
    userCreditsBalance: balance,
    requestedModelId: body.modelId,
  }).route;
  const quality = scoreAppQuality({
    files: fileList,
    hasAuth: fileList.some((f) => /auth|login/i.test(f.path + f.content)),
    hasLoadingStates: fileList.some((f) => /loading|skeleton/i.test(f.content)),
  });

  const quote = quoteGenerationCost({
    mode: "polish",
    selectedModel: routed.modelId,
    complexity: 4,
    expectedFiles: Math.min(fileList.length, 8),
    promptLength: 200,
    userPlan: billing?.plan_id ?? null,
  });

  if (!body.confirm) {
    return NextResponse.json({
      quoteOnly: true,
      estimatedCost: quote.userCreditsRequired,
      reservedEstimate: quote.userCreditsReserved,
      label: quote.userFacingLabel,
      safeToRun: balance >= quote.userCreditsReserved && quote.safeToRun,
      balance,
      qualityScore: quality.scorePercent,
      userSummary: quality.userSummary,
    });
  }

  const operationId = `polish:${authUser.id}:${projectId}:${Date.now()}`;
  const reserve = await reserveCreditsForGeneration(writer, {
    userId: authUser.id,
    userEmail: authUser.email ?? "",
    generationId: operationId,
    projectId,
    balance,
    mode: "polish",
    selectedModel: routed.modelId,
    complexity: 4,
    estimatedProviderCostUsd: quote.estimatedProviderCostUsd,
    expectedFiles: fileList.length,
    userPlan: billing?.plan_id ?? null,
  });

  if (!reserve.ok) {
    return NextResponse.json(
      { error: reserve.error, code: reserve.code },
      { status: reserve.code === "insufficient_tokens" ? 402 : 503 },
    );
  }

  const result = await generatePolishPatches({
    writer,
    userId: authUser.id,
    userEmail: authUser.email ?? null,
    operationId,
    projectId,
    files: fileList,
  });

  const actualCredits = result.ok
    ? Math.max(quote.userCreditsRequired, Math.ceil(result.providerCostUsd * 30 / 10))
    : 0;

  await reconcileGenerationReservation(writer, {
    userId: authUser.id,
    generationId: operationId,
    reservedCredits: reserve.reserved,
    actualUserCredits: actualCredits,
    providerCostUsd: result.providerCostUsd,
    success: result.ok,
    projectId,
  });

  await writer.from("provider_usage_logs" as never).insert({
    user_id: authUser.id,
    project_id: projectId,
    generation_id: operationId,
    operation_type: "polish",
    model_id: routed.modelId,
    provider: routed.provider,
    provider_cost_usd: result.providerCostUsd,
    metadata: {
      quality_before: result.qualityBefore,
      quality_after_estimate: result.qualityAfterEstimate,
      ok: result.ok,
    },
  } as never).then(() => undefined, () => undefined);

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Polish failed", code: "polish_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    summary: result.summary,
    diffs: result.diffs,
    patches: result.patches,
    qualityBefore: result.qualityBefore,
    qualityAfterEstimate: result.qualityAfterEstimate,
    message: "Review the diff before applying. Files are not changed until you accept.",
    reservedCredits: reserve.reserved,
    operationId,
  });
}
