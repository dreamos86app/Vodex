import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadProfileBillingRow } from "@/lib/supabase/load-profile-billing";
import { routeModel, mapChatModeToTask } from "@/lib/ai/model-router";
import { planGenerationBudget } from "@/lib/ai/generation-budget-planner";
import type { GenerationMode } from "@/lib/billing/pricing-config";
import { guardExpensiveRoute } from "@/lib/security/route-guard";
import { isNextResponse } from "@/lib/ids/api-mutation-guard";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  let body: {
    mode?: string;
    prompt?: string;
    modelId?: string;
    projectId?: string;
    fileCount?: number;
    qualityLevel?: string;
    userId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const user = guardExpensiveRoute(sessionUser, "credits", body as Record<string, unknown>);
  if (isNextResponse(user)) return user;

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const modeRaw = body.mode ?? "discuss";
  const mode: GenerationMode =
    modeRaw === "build"
      ? "build"
      : modeRaw === "edit"
        ? "edit"
        : modeRaw === "polish"
          ? "polish"
          : modeRaw === "deploy"
            ? "deploy"
            : modeRaw === "full_build"
              ? "full_build"
              : modeRaw === "repair"
                ? "repair"
                : "discuss";

  const taskMode = mapChatModeToTask(
    mode === "full_build" || mode === "polish" || mode === "repair"
      ? "build"
      : mode === "deploy"
        ? "discuss"
        : mode === "edit"
          ? "edit"
          : mode === "build"
            ? "build"
            : "discuss",
  );
  const routed = routeModel(taskMode, body.modelId);
  const { row: billing } = await loadProfileBillingRow(supabase, user);
  const balance = billing?.credits_remaining ?? 0;

  const plan = planGenerationBudget({
    prompt: prompt || "New app",
    mode,
    selectedModel: routed.modelId,
    fileCount: body.fileCount,
    userPlan: billing?.plan_id ?? null,
    qualityLevel:
      body.qualityLevel === "premium" || body.qualityLevel === "economy"
        ? body.qualityLevel
        : "balanced",
  });

  const quote = plan.creditQuote;
  const safeToRun = balance >= quote.userCreditsReserved && quote.safeToRun;

  return NextResponse.json({
    estimatedCost: quote.userCreditsRequired,
    reservedEstimate: quote.userCreditsReserved,
    label: quote.userFacingLabel,
    safeToRun,
    balance,
    included: [
      "App plan",
      "Generated files",
      "Preview checks",
      "Automatic fixes",
    ],
    savingsNote: "Staged builds use smaller steps to reduce cost versus one-shot generation.",
    providerHardCapUsd: undefined,
    plan: {
      maxSteps: plan.maxSteps,
      maxTotalOutputTokens: plan.maxTotalOutputTokens,
      providerBudgetUsd: plan.providerBudgetUsd,
      complexity: plan.complexity,
    },
  });
}
