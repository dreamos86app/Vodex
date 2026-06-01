import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bootstrapProfileFromOAuth } from "@/lib/auth/profile-bootstrap";
import { planGenerationBudget } from "@/lib/ai/generation-budget-planner";
import { routeModel, mapChatModeToTask } from "@/lib/ai/model-router";
import { ensureProjectConversation } from "@/lib/projects/project-conversation";
import { hasAnyLlmProviderKey } from "@/lib/llm/env-keys";
import { loadProfileBillingRow } from "@/lib/supabase/load-profile-billing";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  isOptionalProfileSchemaError,
  isPostgrestSchemaOrMissingTableError,
} from "@/lib/supabase/schema-errors";
import type { AiPreflightMode } from "@/lib/ai/preflight-types";
import { getChargeTokensProbeCached } from "@/lib/db/charge-probe-cache";
import { classifyCreateIntent } from "@/lib/intent/create-intent-classifier";
import { lifecyclePatch } from "@/lib/projects/project-lifecycle";
import { resolveBuildCreditAllowance } from "@/lib/billing/partial-build-credits";
import { UNTITLED_APP_NAME } from "@/lib/projects/provisional-app-name";

const DEFAULT_MODEL_ID = "automatic";

export type PreflightServerResult =
  | {
      ok: true;
      userId: string;
      projectId: string | null;
      conversationId: string | null;
      tokensRemaining: number;
      creditsEstimate?: number;
      creditsEstimateMax?: number;
      partialBuildCredits?: boolean;
      creditsAvailable?: number;
      creditsReserveAmount?: number;
      modelId?: string;
      provider?: string;
      routeReason?: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
      code?: string;
      hint?: string;
    };

function slugFromTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "app";
}

function dbErrorPayload(
  table: string,
  err: { message?: string; code?: string } | null,
): Extract<PreflightServerResult, { ok: false }> {
  const msg = err?.message ?? "unknown database error";
  const schema = isPostgrestSchemaOrMissingTableError(msg);
  return {
    ok: false,
    error: schema
      ? `Database table or column missing: public.${table}`
      : `Database error on public.${table}`,
    code: schema ? "schema_error" : table === "projects" ? "project_error" : "conversation_error",
    hint: `${msg} — run Supabase migrations for public.${table} and reload the schema cache.`,
    status: schema ? 503 : 500,
  };
}

async function ensureProject(
  writer: SupabaseClient,
  user: User,
  projectId: string | undefined,
  prompt: string,
): Promise<{ id: string } | Extract<PreflightServerResult, { ok: false }>> {
  if (projectId) {
    const { data, error } = await writer
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) return dbErrorPayload("projects", error);
    if (!data?.id) {
      return {
        ok: false,
        status: 404,
        error: "Project not found",
        code: "project_error",
        hint: "This app does not exist or you do not have access.",
      };
    }
    return { id: data.id };
  }

  const name = UNTITLED_APP_NAME;
  const slug = `${slugFromTitle(name)}-${Date.now().toString(36)}`;
  const intent = classifyCreateIntent(prompt, false);
  const lifecycle = intent.shouldFullBuild ? "blueprint_generating" : "intent_review";
  const { data, error } = await writer
    .from("projects")
    .insert({
      owner_id: user.id,
      name,
      slug,
      status: "draft",
      framework: "nextjs",
      metadata: lifecyclePatch(lifecycle, {
        initial_prompt: prompt,
        source: "prompt",
        workflow_step: "intent_review",
        last_intent: intent.intent,
      }),
    } as never)
    .select("id")
    .single();

  if (error || !data?.id) return dbErrorPayload("projects", error);
  return { id: data.id };
}

export async function runAiPreflightServer(request: Request): Promise<PreflightServerResult> {
  if (!hasAnyLlmProviderKey()) {
    return {
      ok: false,
      status: 503,
      error: "AI provider is not configured on this server.",
      code: "llm_setup",
      hint:
        "Set at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY, then restart the server.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      status: 401,
      error: "Sign in required",
      code: "unauthorized",
      hint: "Open /auth/login on the same origin as this tab.",
    };
  }

  let raw: {
    mode?: string;
    prompt?: string;
    projectId?: string;
    conversationId?: string;
    modelId?: string;
  };

  try {
    raw = await request.json();
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body", code: "invalid_body" };
  }

  const mode: AiPreflightMode =
    raw.mode === "build" ? "build" : raw.mode === "edit" ? "edit" : "discuss";
  const prompt = typeof raw.prompt === "string" ? raw.prompt.trim() : "";
  if (!prompt) {
    return { ok: false, status: 400, error: "Prompt is required", code: "empty_prompt" };
  }

  const modelId =
    typeof raw.modelId === "string" && raw.modelId.length > 0 ? raw.modelId : DEFAULT_MODEL_ID;
  const projectIdIn =
    typeof raw.projectId === "string" && raw.projectId.length > 0 ? raw.projectId : undefined;
  const conversationIdIn =
    typeof raw.conversationId === "string" && raw.conversationId.length > 0
      ? raw.conversationId
      : undefined;

  if (mode === "edit" && !projectIdIn) {
    return {
      ok: false,
      status: 400,
      error: "Edit mode requires an app project",
      code: "edit_no_app",
      hint: "Switch to Build to create an app, or open an existing project.",
    };
  }

  const intentCheck = classifyCreateIntent(prompt, Boolean(projectIdIn));
  if (mode === "build" && intentCheck.intent === "question_only") {
    return {
      ok: false,
      status: 400,
      error: intentCheck.userMessage,
      code: "question_only",
      hint: "Use Discuss mode to ask questions without reserving build credits.",
    };
  }
  if (mode === "build" && intentCheck.needsClarification && !intentCheck.shouldFullBuild) {
    return {
      ok: false,
      status: 400,
      error: intentCheck.clarificationPrompt ?? intentCheck.userMessage,
      code: "needs_clarification",
      hint: intentCheck.userMessage,
    };
  }

  try {
    await bootstrapProfileFromOAuth(user, null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "profile_bootstrap_failed";
    if (!isPostgrestSchemaOrMissingTableError(msg) && !isOptionalProfileSchemaError(msg)) {
      return {
        ok: false,
        status: 503,
        error: "Account profile unavailable",
        code: "profile_unavailable",
        hint: msg,
      };
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn("[preflight] bootstrap degraded, continuing:", msg);
    }
  }

  const { row: billingRow, hint: billingHint } = await loadProfileBillingRow(supabase, user);
  if (!billingRow) {
    return {
      ok: false,
      status: 503,
      error: "Account profile unavailable",
      code: "profile_unavailable",
      hint:
        billingHint ??
        "Run Supabase migrations for public.profiles and set SUPABASE_SERVICE_ROLE_KEY for bootstrap.",
    };
  }

  const chargeProbe = await getChargeTokensProbeCached();
  if (!chargeProbe.ok) {
    console.warn("[credits] preflight blocked — charge_tokens not callable", {
      issue: chargeProbe.issue,
      diagnosis: chargeProbe.diagnosis,
    });
    return {
      ok: false,
      status: 503,
      error: "AI requests are temporarily paused while billing sync finishes. Please try again shortly.",
      code: "charge_tokens_missing",
      hint: chargeProbe.nextAction ?? chargeProbe.userMessage ?? chargeProbe.hint,
    };
  }
  console.info("[credits] preflight ok — charge_tokens callable");

  const routedEarly = routeModel(mapChatModeToTask(mode), modelId);
  const budgetPlan = planGenerationBudget({
    prompt,
    mode: mode === "build" ? "full_build" : mode,
    selectedModel: routedEarly.modelId,
    fileCount: mode === "build" ? 12 : mode === "edit" ? 4 : 1,
  });
  const creditEst = {
    creditsMin: budgetPlan.creditQuote.userCreditsRequired,
    creditsMax: budgetPlan.creditQuote.userCreditsReserved,
  };
  const balance = billingRow.credits_remaining;
  const buildAllowance =
    mode === "build"
      ? resolveBuildCreditAllowance(balance, budgetPlan.creditQuote)
      : null;

  if (buildAllowance?.blocked) {
    return {
      ok: false,
      status: 402,
      error: "Your Build Credits are used up. Add credits or upgrade to keep building.",
      code: "blocked_zero_credits",
      hint: "Add Build Credits or upgrade your plan to continue.",
    };
  }

  if (mode !== "build" && balance < budgetPlan.creditQuote.userCreditsReserved) {
    return {
      ok: false,
      status: 402,
      error: "Not enough credits for this request",
      code: "insufficient_tokens",
      hint: `Need ${budgetPlan.creditQuote.userCreditsReserved} credits; you have ${balance}.`,
    };
  }

  const admin = createServiceRoleClient();
  const writer = admin ?? supabase;

  let projectId: string | null = projectIdIn ?? null;
  let conversationId: string | null = conversationIdIn ?? null;

  if (mode === "build") {
    const proj = await ensureProject(writer, user, projectIdIn, prompt);
    if ("ok" in proj) return proj;
    projectId = proj.id;
  } else if (mode === "edit") {
    const proj = await ensureProject(writer, user, projectIdIn, prompt);
    if ("ok" in proj) return proj;
    projectId = proj.id;
  }

  const conv = await ensureProjectConversation({
    writer,
    user,
    conversationId: conversationId ?? undefined,
    projectId: projectId ?? undefined,
    title: prompt,
    modelId,
    mode,
  });
  if ("error" in conv) {
    return {
      ok: false,
      status: conv.status,
      error: conv.error,
      code: conv.code,
      hint: conv.hint,
    };
  }
  conversationId = conv.id;

  const routed = routeModel(mapChatModeToTask(mode), modelId);
  const billedModel = routed.modelId;

  return {
    ok: true,
    userId: user.id,
    projectId,
    conversationId,
    tokensRemaining: balance,
    creditsEstimate: creditEst.creditsMin,
    creditsEstimateMax: creditEst.creditsMax,
    partialBuildCredits: buildAllowance?.partial ?? false,
    creditsAvailable: buildAllowance?.balance ?? balance,
    creditsReserveAmount: buildAllowance?.reserveAmount,
    modelId: billedModel,
    provider: routed.provider,
    routeReason: routed.routeReason,
  };
}
