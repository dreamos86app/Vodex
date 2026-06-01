import { streamText, generateText, convertToModelMessages, type ModelMessage } from "ai";
import type { UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { resolveGoogleLanguageModel } from "@/lib/llm/google-provider";
import { openai } from "@ai-sdk/openai";
import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadMemory, formatMemoryForPrompt } from "@/lib/creation/memory";
import { buildSystemPrompt } from "@/lib/creation/system-prompt";
import { planGenerationBudget } from "@/lib/ai/generation-budget-planner";
import {
  reserveCreditsForGeneration,
  reconcileGenerationReservation,
} from "@/lib/billing/credit-reservations";
import { assertProfitableCharge } from "@/lib/billing/credit-profit-guard";
import type { Json } from "@/lib/supabase/types";
import { loadProfileBillingRow } from "@/lib/supabase/load-profile-billing";
import { parseFencedFiles } from "@/lib/creation/extract-fenced-code";
import {
  extractBuilderMetadata,
  slugifyAppName,
} from "@/lib/creation/parse-builder-metadata";
import { validateGeneratedBuild } from "@/lib/creation/validate-build-quality";
import { validateBuilderOutput } from "@/lib/builder/validate-builder-output";
import { appIconSvgDataUrl } from "@/lib/creation/app-icon-svg";
import { getAppUrl } from "@/lib/app-url";
import { allocatePublishedSubdomain } from "@/lib/publish/subdomain";
import { googleGenerativeApiKey, hasAnyLlmProviderKey } from "@/lib/llm/env-keys";
import { isAutomaticModelId } from "@/lib/ai/resolve-automatic-model";
import { routeModel, mapChatModeToTask, routeOperation } from "@/lib/ai/model-router";
import { routeMainModelSpec } from "@/lib/ai/model-mix-router";
import { resolveStageModel } from "@/lib/ai/model-cost-runtime";
import { completeBuildWithValidation } from "@/lib/build/complete-build-with-validation";
import { guardDiscussProviderCall } from "@/lib/ai/discuss-profit-guard";
import {
  classifyFirstCreatePrompt,
  classifyCreateIntent,
  shouldChargeCreateQuestion,
} from "@/lib/intent/create-intent-classifier";
import {
  classifyProviderError,
  pickFailoverCatalogModel,
  providerFromModelId,
  sanitizeUserFacingAiError,
} from "@/lib/ai/provider-errors";
import {
  isProviderSelectable,
  recordProviderFailure,
  recordProviderSuccess,
} from "@/lib/ai/provider-availability";
import { executeStagedBuildJob } from "@/lib/build/execute-staged-build-job";
import { shouldRunInlineAsyncBuild } from "@/lib/build/schedule-async-build";
import { emitInitialBuildEvents } from "@/lib/build/build-job-events";
import { buildIntakeFromPrompt } from "@/lib/ai/huge-prompt-intake";
import { effectivePromptLengthForCredits } from "@/lib/ai/build-credit-classifier";
import {
  resolveBuildCreditAllowance,
  userFacingPartialBuildStartMessage,
} from "@/lib/billing/partial-build-credits";
import {
  formatFinishEverythingEstimate,
  parseContinueIntent,
} from "@/lib/build/build-continuation-plan";
import {
  estimateContinuationCredits,
  loadBuildBacklog,
  pickNextBacklogItems,
} from "@/lib/build/build-backlog";
import { calculateCreditsForStagedBuild } from "@/lib/credits/credit-pricing";
import { chargeAiOperation } from "@/lib/credits/charge-ai-operation";
import { calculateCreditsToCharge } from "@/lib/credits/calculate-charge";
import { finalizeBuildSuccess, finalizeBuildFailed } from "@/lib/build/finalize-build";
import { runBuildQualityRepair } from "@/lib/build/quality-repair";
import { ensureProjectConversation } from "@/lib/projects/project-conversation";
import { loadProjectContextBlock, refineAppName } from "@/lib/projects/project-context";
import { assertProjectAccess } from "@/lib/projects/project-access";
import {
  resolveCreditBillingTarget,
  fetchProfileBalance,
  billingSourceLabel,
} from "@/lib/billing/workspace-credit-billing";
import { parseAppBlueprint, requiresBlueprintApproval } from "@/lib/build/blueprint-schema";
import { buildDeterministicBlueprint } from "@/lib/build/blueprint-deterministic";
import { readCreateFlowConfig, buildTierToQualityLevel } from "@/lib/create/create-flow-config";
import { formatBlueprintForBuild } from "@/lib/build/format-blueprint-prompt";
import { maybeCreatePendingDiffFromChatEdit } from "@/lib/chat/post-edit-pending-diff";
import {
  hasRecentRunningBuildJob,
  findRecentRunningBuildJobId,
  hasSuccessfulChargeForOperation,
  hasUserMessageForOperation,
} from "@/lib/chat/server-idempotency";
import {
  classifyBuildIntent,
  shouldStartBuildPipeline,
  shouldStartBuildPipelineInProject,
} from "@/lib/ai/build-intent-classifier";
import { ensureUserProfileServer } from "@/lib/auth/ensure-user-profile-server";
import { getChargeTokensProbeCached } from "@/lib/db/charge-probe-cache";
import { resolveDiscussModel, userSafeAiUnavailableMessage } from "@/lib/ai/provider-fallback";
import { anyProviderSelectable } from "@/lib/ai/provider-health";
import { toApiModelId } from "@/lib/ai/model-catalog";
import { requireId } from "@/lib/diagnostics/require-ids";
import { dreamosLog } from "@/lib/diagnostics/dreamos-logger";
import { logServerOperation } from "@/lib/ops/server-ops-log";
import { requireAuthUser, isNextResponse } from "@/lib/ids/api-mutation-guard";
import { googleProviderOptionsForApiModel, withGoogleProviderOptions } from "@/lib/ai/gemini-generate-options";
import { guardExpensiveRoute } from "@/lib/security/route-guard";

const LLM_SETUP_ERROR = "AI provider is not configured on this server.";
const LLM_SETUP_HINT =
  "Add at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY to the server environment, then restart.";

/** Cheapest available discuss model — skips exhausted providers (Anthropic quota → OpenAI). */
function pickFreeDiscussModelId(): string {
  return resolveDiscussModel(null).modelId;
}

function resolveModel(modelId: string) {
  const resolved = toApiModelId(modelId);
  if (resolved.startsWith("gemini")) {
    if (!googleGenerativeApiKey()) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured on the server");
    }
    return resolveGoogleLanguageModel(resolved);
  }
  if (resolved.startsWith("claude")) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured on the server");
    }
    return anthropic(resolved);
  }
  if (resolved.startsWith("gpt")) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured on the server");
    }
    return openai(resolved);
  }
  if (process.env.OPENAI_API_KEY) return openai("gpt-4o-mini");
  if (googleGenerativeApiKey()) return resolveGoogleLanguageModel("gemini-2.0-flash");
  if (process.env.ANTHROPIC_API_KEY) return anthropic("claude-haiku-4-5");
  throw new Error("No LLM API key configured (OpenAI, Google, or Anthropic)");
}

function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last?.parts?.length) return "";
  return last.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function planIsFree(planId: string | null | undefined): boolean {
  if (!planId) return true;
  const p = planId.toLowerCase();
  return p === "free" || p === "starter";
}

function injectUserImages(messages: ModelMessage[], imageUrls: string[]): ModelMessage[] {
  if (imageUrls.length === 0) return messages;
  const idx = messages.findLastIndex((m) => m.role === "user");
  if (idx < 0) return messages;
  const cur = messages[idx];
  if (cur.role !== "user") return messages;

  const contentParts: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: URL }
  > = [];

  if (typeof cur.content === "string") {
    contentParts.push({ type: "text", text: cur.content });
  } else if (Array.isArray(cur.content)) {
    for (const part of cur.content) {
      if (part.type === "text") contentParts.push(part);
      if (part.type === "image" && part.image instanceof URL) {
        contentParts.push({ type: "image", image: part.image });
      }
      if (part.type === "image" && typeof part.image === "string") {
        try {
          contentParts.push({ type: "image", image: new URL(part.image) });
        } catch {
          /* skip */
        }
      }
    }
  }

  for (const url of imageUrls) {
    try {
      contentParts.push({ type: "image", image: new URL(url) });
    } catch {
      /* skip */
    }
  }

  const next = [...messages];
  next[idx] = { role: "user", content: contentParts };
  return next;
}

function appendFileLinks(
  messages: ModelMessage[],
  files: { name: string; url: string }[],
): ModelMessage[] {
  if (files.length === 0) return messages;
  const idx = messages.findLastIndex((m) => m.role === "user");
  if (idx < 0) return messages;
  const cur = messages[idx];
  if (cur.role !== "user") return messages;

  const suffix = `\n\n(Attachments)\n${files.map((f) => `- [${f.name}](${f.url})`).join("\n")}`;
  const next = [...messages];

  if (typeof cur.content === "string") {
    next[idx] = { role: "user", content: cur.content + suffix };
    return next;
  }

  if (Array.isArray(cur.content)) {
    const hadText = cur.content.some((p) => p.type === "text");
    const out = cur.content.map((part) => {
      if (part.type === "text" && "text" in part && typeof part.text === "string") {
        return { ...part, text: part.text + suffix };
      }
      return part;
    });
    next[idx] = {
      role: "user",
      content: hadText ? out : [...out, { type: "text" as const, text: suffix.trim() }],
    };
  }

  return next;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "production") {
    console.info("[api/chat] POST");
  }
  const supabase = await createClient();
  const admin = createServiceRoleClient();
  const writer = admin ?? supabase;

  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  let raw: {
    messages?: UIMessage[];
    modelId?: string;
    conversationId?: string;
    mode?: "discuss" | "edit" | "build";
    mode_at_submit?: "discuss" | "edit" | "build";
    scope?: string | null;
    editTarget?: string | null;
    projectId?: string;
    attachmentIds?: unknown;
    operationId?: string;
    idempotencyKey?: string;
    approvedBlueprint?: unknown;
    qualityLevel?: string;
    templateId?: string;
    stylePresetId?: string;
    createQuestion?: boolean;
    planFirstOnly?: boolean;
    strategy?: "build_now" | "plan_first";
    forceBuildPipeline?: boolean;
  };

  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const authUser = guardExpensiveRoute(sessionUser, "chat", raw as Record<string, unknown>);
  if (isNextResponse(authUser)) return authUser;
  const user = authUser;

  const uiMessages = raw.messages ?? [];
  if (!Array.isArray(uiMessages) || uiMessages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const userTextGuard = lastUserText(uiMessages).trim();
  if (!userTextGuard) {
    return NextResponse.json({ error: "empty_prompt", code: "empty_prompt" }, { status: 400 });
  }

  let conversationId =
    typeof raw.conversationId === "string" && raw.conversationId.length > 0
      ? raw.conversationId
      : undefined;

  const attachmentIds: string[] = Array.isArray(raw.attachmentIds)
    ? raw.attachmentIds.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];

  if (attachmentIds.length > 0 && !conversationId) {
    return NextResponse.json(
      { error: "conversationId required when sending attachments" },
      { status: 400 },
    );
  }

  const modeAtSubmit: "discuss" | "edit" | "build" =
    raw.mode_at_submit === "edit" || raw.mode_at_submit === "build" || raw.mode_at_submit === "discuss"
      ? raw.mode_at_submit
      : raw.mode === "edit"
        ? "edit"
        : raw.mode === "build"
          ? "build"
          : "discuss";
  const mode = modeAtSubmit;
  const scope =
    typeof raw.editTarget === "string" && raw.editTarget.trim()
      ? raw.editTarget.trim()
      : typeof raw.scope === "string"
        ? raw.scope
        : null;
  const projectId =
    typeof raw.projectId === "string" && raw.projectId.length > 0 ? raw.projectId : undefined;

  if (mode === "edit" && !projectId) {
    return NextResponse.json(
      { error: "Edit mode requires an existing project.", code: "edit_requires_project" },
      { status: 400 },
    );
  }

  if (mode === "edit" && projectId) {
    const { count } = await writer
      .from("app_files")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    if (!count || count < 1) {
      return NextResponse.json(
        { error: "Edit mode requires generated files. Use Build mode first.", code: "edit_requires_files" },
        { status: 400 },
      );
    }
  }

  const { row: billingRow, hint: billingHint } = await loadProfileBillingRow(supabase, user);
  if (!billingRow) {
    return NextResponse.json(
      {
        error: "Account profile unavailable",
        hint:
          billingHint ??
          "Run Supabase migrations for public.profiles, set SUPABASE_SERVICE_ROLE_KEY for bootstrap, then reload the schema.",
      },
      { status: 503 },
    );
  }
  if (billingHint && process.env.NODE_ENV !== "production") {
    console.warn("[chat] profile billing degraded:", billingHint);
  }

  await ensureUserProfileServer(user.id, user.email ?? null);

  let projectAccess: Awaited<ReturnType<typeof assertProjectAccess>> = null;
  if (projectId) {
    const needsEdit = mode === "edit" || mode === "build";
    projectAccess = await assertProjectAccess(writer, user.id, projectId, {
      requireEdit: needsEdit,
    });
    if (!projectAccess) {
      return NextResponse.json(
        { error: "Project not found or you do not have access.", code: "project_access_denied" },
        { status: 403 },
      );
    }
  }

  const chargeProbe = await getChargeTokensProbeCached();
  if (!chargeProbe.ok) {
    dreamosLog({
      source: "server",
      category: "provider_blocked",
      severity: "warn",
      message: "Provider calls blocked — charge_tokens not callable",
      userId: user.id,
      action: "charge_tokens_missing",
      metadata: { issue: chargeProbe.issue },
    });
    await logServerOperation({
      writer,
      userId: user.id,
      userEmail: user.email,
      stage: "charge",
      event: "charge_tokens_missing",
      status: "error",
      errorMessage: chargeProbe.lastError,
      mode,
    });
    return NextResponse.json(
      {
        error: "AI requests are temporarily paused while billing sync finishes. Please try again shortly.",
        code: "charge_tokens_missing",
        hint: chargeProbe.nextAction ?? chargeProbe.userMessage ?? chargeProbe.hint,
      },
      { status: 503 },
    );
  }

  const profileRow = billingRow;

  if (!hasAnyLlmProviderKey()) {
    return NextResponse.json(
      {
        error: LLM_SETUP_ERROR,
        hint: LLM_SETUP_HINT,
      },
      { status: 503 },
    );
  }

  if (!anyProviderSelectable()) {
    return NextResponse.json(
      {
        error: userSafeAiUnavailableMessage(),
        code: "provider_unavailable",
      },
      { status: 503 },
    );
  }

  const userTextEarly = lastUserText(uiMessages);
  const createQuestionRequest = raw.createQuestion === true;
  const explicitStrategy =
    raw.strategy === "build_now" || raw.strategy === "plan_first" ? raw.strategy : undefined;
  const forceBuildPipeline = raw.forceBuildPipeline === true;
  let planFirstOnly = raw.planFirstOnly === true;
  if (explicitStrategy === "build_now" && forceBuildPipeline) {
    planFirstOnly = false;
  }
  const buildIntent =
    mode === "build" && userTextEarly ? classifyBuildIntent(userTextEarly) : null;
  let startBuildPipeline =
    projectId && mode === "build" && userTextEarly
      ? shouldStartBuildPipelineInProject(mode, projectId, userTextEarly)
      : shouldStartBuildPipeline(mode, buildIntent);
  if (planFirstOnly) {
    startBuildPipeline = false;
  }
  if (forceBuildPipeline && explicitStrategy === "build_now" && mode === "build" && userTextEarly.trim()) {
    startBuildPipeline = true;
    planFirstOnly = false;
  }
  if (modeAtSubmit === "discuss") {
    startBuildPipeline = false;
    planFirstOnly = false;
  }
  const firstCreateIntent =
    userTextEarly && mode === "build" && !projectId
      ? classifyFirstCreatePrompt(userTextEarly)
      : userTextEarly && createQuestionRequest
        ? classifyFirstCreatePrompt(userTextEarly)
        : null;

  let chargeMode: "discuss" | "create_question" | "edit" | "build" =
    mode === "build" && !startBuildPipeline ? "discuss" : mode;

  if (createQuestionRequest && firstCreateIntent && shouldChargeCreateQuestion(firstCreateIntent)) {
    startBuildPipeline = false;
    chargeMode = "create_question";
  } else if (
    firstCreateIntent &&
    shouldChargeCreateQuestion(firstCreateIntent) &&
    mode === "build" &&
    startBuildPipeline &&
    !createQuestionRequest &&
    !planFirstOnly &&
    !projectId
  ) {
    return NextResponse.json(
      {
        error: "This looks like a question — use Get answer on Create or rephrase as a build request.",
        code: "question_only",
        intent: firstCreateIntent.intent,
        userMessage: firstCreateIntent.userMessage,
      },
      { status: 400 },
    );
  }

  const wantsAsyncBuild = request.headers.get("X-DreamOS-Async-Build") === "1";

  console.info("[build-intent]", {
    intent: buildIntent?.intent ?? "n/a",
    confidence: buildIntent?.confidence,
    reason: buildIntent?.reason,
    startBuildPipeline,
    chargeMode,
    createQuestion: createQuestionRequest,
    firstCreateIntent: firstCreateIntent?.intent,
    wantsAsyncBuild,
  });

  if (wantsAsyncBuild && mode === "build" && projectId && userTextEarly.trim().length >= 3) {
    if (
      (forceBuildPipeline && explicitStrategy === "build_now") ||
      shouldStartBuildPipelineInProject(mode, projectId, userTextEarly)
    ) {
      startBuildPipeline = true;
      chargeMode = "build";
      planFirstOnly = false;
    }
  }

  if (wantsAsyncBuild && mode === "build" && !startBuildPipeline) {
    return NextResponse.json(
      {
        error: "This prompt cannot start a background build.",
        code: "build_pipeline_unavailable",
        intent: buildIntent?.intent ?? null,
        hint:
          buildIntent?.intent === "support_answer"
            ? "Phrases like “contact form” on a page are app features — try “Build a site with a contact form”."
            : "Use Build with a clear app request (e.g. “Build a portfolio…”), or switch to Discuss for questions.",
      },
      { status: 409 },
    );
  }

  const freePlan = planIsFree(profileRow.plan_id as string | undefined);
  const requestedModel =
    typeof raw.modelId === "string" && raw.modelId.length > 0 ? raw.modelId : undefined;
  const manualModelSelection = Boolean(requestedModel && !isAutomaticModelId(requestedModel));
  const taskMode = mapChatModeToTask(mode);
  const createIntent =
    firstCreateIntent?.intent ??
    (userTextEarly && mode === "build"
      ? classifyCreateIntent(userTextEarly, Boolean(projectId)).intent
      : undefined);
  let projectQuality: "quick" | "standard" | "production" | "premium" = "standard";
  if (projectId) {
    const { data: projQ } = await writer
      .from("projects")
      .select("metadata")
      .eq("id", projectId)
      .maybeSingle();
    const cfg = readCreateFlowConfig(projQ?.metadata);
    projectQuality = buildTierToQualityLevel(cfg.buildTier);
  }
  if (raw.qualityLevel === "quick" || raw.qualityLevel === "production" || raw.qualityLevel === "premium") {
    projectQuality = raw.qualityLevel === "premium" ? "premium" : raw.qualityLevel;
  }

  const costRuntime = resolveStageModel({
    stage: mode === "build" ? "ui_generation" : mode === "edit" ? "file_plan" : "intent",
    intent: createIntent,
    mode: chargeMode === "create_question" ? "discuss" : chargeMode,
    userCreditsBalance: profileRow.credits_remaining ?? 0,
    requestedModelId: requestedModel,
    qualityLevel: projectQuality,
  });
  const routed = costRuntime.route;
  const modelId =
    freePlan && taskMode === "discuss"
      ? pickFreeDiscussModelId()
      : routed.modelId;
  const billedModelId = modelId;

  if (routed.missingEnv.length > 0 && !hasAnyLlmProviderKey()) {
    return NextResponse.json(
      {
        error: LLM_SETUP_ERROR,
        hint: LLM_SETUP_HINT,
        missingEnv: routed.missingEnv,
      },
      { status: 503 },
    );
  }

  console.info("[ai-route]", {
    mode: taskMode,
    provider: routed.provider,
    modelId: billedModelId,
    routeReason: routed.routeReason,
    isFallback: routed.isFallback,
    tier: routed.estimatedTier,
  });

  let modelMessages: ModelMessage[];
  try {
    modelMessages = await convertToModelMessages(uiMessages, {
      ignoreIncompleteToolCalls: true,
    });
  } catch {
    return NextResponse.json({ error: "Invalid messages payload" }, { status: 400 });
  }

  let attachmentRows: Array<{
    id: string;
    public_url: string;
    mime_type: string;
    file_name: string | null;
  }> = [];

  if (attachmentIds.length > 0) {
    const { data: attData, error: attErr } = await supabase
      .from("message_attachments")
      .select("id, public_url, mime_type, file_name")
      .eq("user_id", user.id)
      .in("id", attachmentIds);
    if (attErr) {
      return NextResponse.json({ error: "Could not verify attachments" }, { status: 400 });
    }
    attachmentRows = attData ?? [];
    if (attachmentRows.length !== attachmentIds.length) {
      return NextResponse.json({ error: "Invalid or stale attachment references" }, { status: 400 });
    }
  }

  const imageUrls = attachmentRows.filter((r) => r.mime_type.startsWith("image/")).map((r) => r.public_url);
  const fileLinks = attachmentRows
    .filter((r) => !r.mime_type.startsWith("image/"))
    .map((r) => ({ name: r.file_name ?? "file", url: r.public_url }));

  modelMessages = appendFileLinks(modelMessages, fileLinks);
  modelMessages = injectUserImages(modelMessages, imageUrls);

  const userText = lastUserText(uiMessages);
  const budgetPlan = planGenerationBudget({
    prompt: userText || userTextEarly || "",
    mode: startBuildPipeline
      ? "full_build"
      : chargeMode === "create_question"
        ? "discuss"
        : chargeMode,
    selectedModel: modelId,
    userPlan: profileRow.plan_id as string | undefined,
    hasExistingProject: Boolean(projectId),
    qualityLevel:
      projectQuality === "quick"
        ? "economy"
        : projectQuality === "production" || projectQuality === "premium"
          ? "premium"
          : "balanced",
  });
  const tokensNeeded = budgetPlan.creditQuote.userCreditsReserved;
  let creditBillingTarget: Awaited<ReturnType<typeof resolveCreditBillingTarget>> | null = null;
  if (projectId) {
    creditBillingTarget = await resolveCreditBillingTarget(writer, {
      actorUserId: user.id,
      projectId,
      workspaceId: projectAccess?.workspaceId ?? null,
    });
  }

  let balance = profileRow.credits_remaining ?? 0;
  if (creditBillingTarget && creditBillingTarget.billedUserId !== user.id) {
    balance = await fetchProfileBalance(writer, creditBillingTarget.billedUserId);
  }
  const buildAllowance = startBuildPipeline
    ? resolveBuildCreditAllowance(balance, budgetPlan.creditQuote)
    : null;

  if (buildAllowance?.blocked) {
    return NextResponse.json(
      {
        error: "Your Build Credits are used up. Add credits or upgrade to keep building.",
        code: "blocked_zero_credits",
        tokens_remaining: balance,
        tokens_required: tokensNeeded,
      },
      { status: 402 },
    );
  }

  if (!startBuildPipeline && balance < tokensNeeded) {
    return NextResponse.json(
      {
        error: "insufficient_tokens",
        tokens_remaining: balance,
        tokens_required: tokensNeeded,
        estimated_cost: budgetPlan.creditQuote.userCreditsRequired,
        hint:
          chargeMode === "discuss"
            ? "Add Build Credits to continue Discuss."
            : chargeMode === "create_question"
              ? "Add Build Credits to get an answer."
              : "Add Build Credits or use a smaller build scope.",
      },
      { status: 402 },
    );
  }

  if (chargeMode === "discuss" || chargeMode === "create_question") {
    const estIn = Math.min(4000, userText.length * 2 + 800);
    const discussGuard = guardDiscussProviderCall({
      modelId: billedModelId,
      estimatedInputTokens: estIn,
      estimatedOutputTokens: 800,
      mode: "discuss",
      respectManualSelection: manualModelSelection,
    });
    if (!discussGuard.allowed) {
      return NextResponse.json(
        {
          error: discussGuard.userMessage ?? "Discuss request too large for this mode.",
          code: "discuss_context_too_large",
        },
        { status: 400 },
      );
    }
    if (discussGuard.action === "fallback_cheap") {
      console.info("[discuss-guard]", discussGuard.adminNote, { cheapId: discussGuard.modelId });
    }
  }

  const userEmail = profileRow.email || user.email || "";

  const attachmentsJson: Json = attachmentRows.map((r) => ({
    id: r.id,
    url: r.public_url,
    mime: r.mime_type,
    name: r.file_name ?? "attachment",
  })) as unknown as Json;

  if (userText && !conversationId) {
    const conv = await ensureProjectConversation({
      writer,
      user,
      projectId,
      title: userText.slice(0, 60) || "New conversation",
      modelId,
      mode,
    });
    if ("error" in conv) {
      return NextResponse.json(
        { error: conv.error, hint: conv.hint ?? "Check Supabase migrations for conversations." },
        { status: conv.status },
      );
    }
    conversationId = conv.id;
  } else if (conversationId && projectId) {
    await ensureProjectConversation({
      writer,
      user,
      conversationId,
      projectId,
      title: userText?.slice(0, 60) ?? "Project",
      modelId,
      mode,
    });
  }

  const clientOpId =
    typeof raw.operationId === "string" && raw.operationId.length > 0
      ? raw.operationId
      : typeof raw.idempotencyKey === "string" && raw.idempotencyKey.length > 0
        ? raw.idempotencyKey
        : null;

  let opId =
    clientOpId ??
    `chat:${user.id}:${conversationId ?? "new"}:${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  let buildJobId: string | null = null;
  if (startBuildPipeline && projectId && userText) {
    const dupBuild = await hasRecentRunningBuildJob(writer, projectId, userText);
    if (dupBuild) {
      buildJobId = await findRecentRunningBuildJobId(writer, projectId, userText);
    }
    if (!dupBuild) {
    const { data: projMetaRow } = await writer
      .from("projects")
      .select("metadata")
      .eq("id", projectId)
      .maybeSingle();
    const prevBuildMeta =
      projMetaRow?.metadata && typeof projMetaRow.metadata === "object" && !Array.isArray(projMetaRow.metadata)
        ? (projMetaRow.metadata as Record<string, unknown>)
        : {};
    await writer
      .from("projects")
      .update({
        build_status: "building",
        metadata: {
          ...prevBuildMeta,
          shell_only: false,
          hide_from_list: false,
          hide_from_home: false,
        },
      } as never)
      .eq("id", projectId);

    const { data: bj, error: bjErr } = await writer
      .from("build_jobs")
      .insert({
        user_id: user.id,
        project_id: projectId,
        conversation_id: conversationId ?? null,
        status: "running",
        started_at: new Date().toISOString(),
        prompt: userText,
        result_summary: null,
        error_message: null,
        meta: {
          model_id: modelId,
          mode_at_submit: modeAtSubmit,
          intent: buildIntent?.intent,
          intent_confidence: buildIntent?.confidence,
          intent_reason: buildIntent?.reason,
        } as Json,
      } as never)
      .select("id")
      .single();
    buildJobId = bj?.id ?? null;
    if (buildJobId && !clientOpId) {
      opId = `build:${user.id}:${projectId}:${buildJobId}`;
    }
    if (bjErr && process.env.NODE_ENV !== "production") {
      console.warn("[chat] build_jobs insert:", bjErr.message);
    }
    }
  }

  let userMessageId: string | null = null;
  if (conversationId && userText) {
    const dupMsg = await hasUserMessageForOperation(writer, conversationId, opId);
    if (!dupMsg) {
    const { data: userMsg, error: insUserErr } = await writer
      .from("messages")
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "user",
        content: userText,
        credits_used: 0,
        model_id: modelId,
        attachments: attachmentsJson,
        metadata: { operation_id: opId, mode: modeAtSubmit, mode_at_submit: modeAtSubmit } as never,
      })
      .select("id")
      .single();

    if (insUserErr && process.env.NODE_ENV !== "production") {
      console.warn("[chat] user message insert:", insUserErr.message);
    }
    userMessageId = userMsg?.id ?? null;
    if (userMessageId && !clientOpId && conversationId) {
      opId = `ai:${user.id}:${conversationId}:${userMessageId}`;
    }

    if (userMessageId && attachmentIds.length > 0) {
      await writer
        .from("message_attachments")
        .update({ message_id: userMessageId, conversation_id: conversationId })
        .in("id", attachmentIds);
    }
    }
  }

  let memoryBlock = "";
  if (projectId) {
    const { entries } = await loadMemory(supabase, { projectId, limit: 30 });
    memoryBlock = formatMemoryForPrompt(entries);
    const projectCtx = await loadProjectContextBlock(writer, projectId, user.id);
    if (projectCtx) {
      memoryBlock = memoryBlock
        ? `${memoryBlock}\n\n---\nCurrent project state:\n${projectCtx}\n---`
        : `---\nCurrent project state:\n${projectCtx}\n---`;
    }
  }

  const systemPrompt = buildSystemPrompt({
    mode,
    scope,
    projectMemoryBlock: memoryBlock,
    hasProject: !!projectId,
  });

  if (startBuildPipeline && projectId && userText) {
    if (!requireId("projectId", projectId, { source: "server", userId: user.id, route: "/api/chat" })) {
      return NextResponse.json({ error: "projectId required for build", code: "missing_project_id" }, { status: 400 });
    }

    let blueprintBlock = "";
    const { data: projMetaRow } = await writer
      .from("projects")
      .select("metadata")
      .eq("id", projectId)
      .maybeSingle();
    const buildMeta = (projMetaRow?.metadata ?? {}) as Record<string, unknown>;
    const buildCfg = readCreateFlowConfig(buildMeta);
    const buildUiCtx = {
      stylePresetId: buildCfg.stylePresetId,
      templateId: buildCfg.templateId,
      buildTier: buildCfg.buildTier,
    };

    const bodyBp = raw.approvedBlueprint;
    if (bodyBp) {
      const parsed = parseAppBlueprint(bodyBp);
      if (parsed.ok) blueprintBlock = formatBlueprintForBuild(parsed.blueprint, buildUiCtx);
    }
    if (!blueprintBlock) {
      const stored = buildMeta.approved_blueprint;
      if (stored) {
        const parsed = parseAppBlueprint(stored);
        if (parsed.ok) blueprintBlock = formatBlueprintForBuild(parsed.blueprint, buildUiCtx);
      }
    }

    if (!blueprintBlock && requiresBlueprintApproval(projectQuality)) {
      if (planFirstOnly) {
        return NextResponse.json(
          {
            error: "Approve your blueprint before starting a full build.",
            code: "blueprint_not_approved",
          },
          { status: 400 },
        );
      }
      const autoBlueprint = buildDeterministicBlueprint({
        prompt: userText,
        templateId: buildCfg.templateId,
        stylePresetId: buildCfg.stylePresetId,
        modelId,
        qualityLevel: projectQuality,
      });
      blueprintBlock = formatBlueprintForBuild(autoBlueprint, buildUiCtx);
      try {
        await writer
          .from("projects")
          .update({
            metadata: {
              ...buildMeta,
              approved_blueprint: autoBlueprint,
              blueprint_auto_approved: true,
            } as never,
          })
          .eq("id", projectId);
      } catch {
        /* non-fatal — build can proceed with in-memory blueprint */
      }
    }

    const intakePreview = buildIntakeFromPrompt(userText);
    const reservePromptLength = effectivePromptLengthForCredits(
      userText.length,
      intakePreview.wasHuge,
    );

    const continueIntent = parseContinueIntent(userText);
    if (continueIntent.kind === "finish_everything" && projectId) {
      const backlog = await loadBuildBacklog(writer, projectId);
      const total = estimateContinuationCredits(backlog);
      return NextResponse.json({
        message: formatFinishEverythingEstimate(total),
        code: "finish_everything_estimate",
        estimatedCredits: total,
        backlogCount: backlog.length,
      });
    }

    const reserve = await reserveCreditsForGeneration(writer, {
      actorUserId: user.id,
      userId: user.id,
      userEmail,
      generationId: opId,
      projectId,
      workspaceId: projectAccess?.workspaceId ?? null,
      conversationId,
      balance,
      mode: "full_build",
      selectedModel: modelId,
      complexity: budgetPlan.complexity,
      estimatedProviderCostUsd: budgetPlan.providerBudgetUsd,
      promptLength: reservePromptLength,
      expectedFiles: 12,
      userPlan: profileRow.plan_id as string | undefined,
      overrideReserveAmount: buildAllowance?.reserveAmount,
    });

    if (!reserve.ok) {
      return NextResponse.json(
        {
          error: reserve.error,
          code: reserve.code,
          tokens_remaining: balance,
          tokens_required: reserve.quote?.userCreditsReserved ?? tokensNeeded,
        },
        {
          status:
            reserve.code === "insufficient_tokens" || reserve.code === "blocked_zero_credits"
              ? 402
              : 503,
        },
      );
    }

    let buildPrompt = userText;
    if (continueIntent.kind === "continue_all" || continueIntent.kind === "continue_category") {
      const nextItems = await pickNextBacklogItems(
        writer,
        projectId,
        5,
        continueIntent.category as import("@/lib/build/build-backlog").BacklogCategory | undefined,
      );
      if (nextItems.length) {
        buildPrompt = `Continue building these queued items:\n${nextItems.map((i) => `- ${i.title} (${i.category})`).join("\n")}\n\nFocus on delivering working code for this pass.`;
      }
    }

    if (!buildJobId) {
      return NextResponse.json(
        { error: "Could not start build job", code: "build_job_failed" },
        { status: 503 },
      );
    }

    await emitInitialBuildEvents(writer, {
      jobId: buildJobId,
      projectId,
      userId: user.id,
      promptHint: buildPrompt.trim().slice(0, 160) || undefined,
    });

    const jobInput = {
      writer,
      userId: user.id,
      userEmail,
      operationId: opId,
      projectId,
      buildJobId,
      userPrompt: buildPrompt,
      memoryBlock,
      conversationId,
      modelId: billedModelId,
      reservedCredits: reserve.reserved,
      partialCreditBuild: buildAllowance?.partial ?? false,
      quotedCreditsRequired: buildAllowance?.quotedReserve ?? tokensNeeded,
      blueprintBlock: blueprintBlock || undefined,
      userSelectedModelId: requestedModel,
    };

    const runAsyncBuild = () =>
      executeStagedBuildJob(jobInput).catch((err) => {
        console.error("[async-build] worker_error", {
          buildJobId,
          operationId: opId,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    if (shouldRunInlineAsyncBuild()) {
      void runAsyncBuild();
    } else {
      after(runAsyncBuild);
    }

    return NextResponse.json(
      {
        ok: true,
        asyncBuild: true,
        buildJobId,
        operationId: opId,
        projectId,
        conversationId: conversationId ?? null,
        eventsUrl: `/api/projects/${projectId}/build-jobs/${buildJobId}/events`,
        message: buildAllowance?.partial
          ? userFacingPartialBuildStartMessage(buildAllowance.balance)
          : "Build started — track progress via events.",
        partialBuild: buildAllowance?.partial ?? false,
        creditsReserved: reserve.reserved,
        billingSource: creditBillingTarget ? billingSourceLabel(creditBillingTarget) : "Your personal credits",
      },
      {
        status: 202,
        headers: {
          "X-DreamOS-Async-Build": "1",
          "X-DreamOS-Build-Job-Id": buildJobId,
          ...(creditBillingTarget
            ? { "X-Vodex-Billing-Source": billingSourceLabel(creditBillingTarget) }
            : {}),
        },
      },
    );
  }

  const streamOp =
    chargeMode === "edit"
      ? "edit_stream"
      : chargeMode === "discuss" || chargeMode === "create_question"
        ? "discuss_stream"
        : "discuss_stream";
  if (clientOpId) {
    const billedForIdempotency = creditBillingTarget?.billedUserId ?? user.id;
    const alreadyDone = await hasSuccessfulChargeForOperation(writer, billedForIdempotency, opId);
    if (alreadyDone) {
      return NextResponse.json(
        {
          error: "This request was already completed.",
          code: "duplicate_operation",
        },
        { status: 409 },
      );
    }
  }

  const buildComplexity = 5;

  const mixRouted = routeMainModelSpec({
    operationType: streamOp,
    userSelectedModelId: requestedModel,
    complexity: buildComplexity,
    ownerEmail: userEmail,
  });
  let streamSpec = mixRouted.spec;

  if (chargeMode === "discuss" || chargeMode === "create_question") {
    const estIn = Math.min(4000, userText.length * 2 + 800);
    const discussGuard = guardDiscussProviderCall({
      modelId: streamSpec.modelId,
      estimatedInputTokens: estIn,
      estimatedOutputTokens: 800,
      mode: "discuss",
      respectManualSelection: manualModelSelection,
    });
    if (discussGuard.action === "fallback_cheap" && !manualModelSelection) {
      streamSpec = routeOperation({
        operationType: streamOp,
        ownerEmail: userEmail,
        requestedModelId: discussGuard.modelId,
        complexity: buildComplexity,
      });
    }
  }

  const primaryProvider = providerFromModelId(streamSpec.modelId);
  if (!isProviderSelectable(primaryProvider)) {
    if (!isAutomaticModelId(requestedModel)) {
      return NextResponse.json(
        {
          error:
            "Selected model is temporarily unavailable. Use Automatic or choose another model.",
          code: "selected_model_unavailable",
        },
        { status: 503 },
      );
    }
    const altId = pickFailoverCatalogModel(primaryProvider, streamOp);
    if (altId) {
      streamSpec = routeOperation({
        operationType: streamOp,
        ownerEmail: userEmail,
        requestedModelId: altId,
        complexity: buildComplexity,
      });
    }
  }

  const billedStreamModelId = streamSpec.modelId;
  const streamProvider = providerFromModelId(billedStreamModelId);

  let model;
  try {
    model = resolveModel(streamSpec.apiModelId);
  } catch (cfgErr) {
    const msg = cfgErr instanceof Error ? cfgErr.message : LLM_SETUP_ERROR;
    await writer.from("ai_usage_logs").insert({
      user_id: user.id,
      user_email: userEmail,
      model_id: modelId,
      mode,
      tokens_charged: 0,
      tokens_input: null,
      tokens_output: null,
      status: "error",
      error_message: msg,
      conversation_id: conversationId ?? null,
      operation_id: opId,
    });
    if (buildJobId) {
      await writer
        .from("build_jobs")
        .update({
          status: "failed",
          error_message: msg,
        })
        .eq("id", buildJobId);
    }
    const isSetup = !hasAnyLlmProviderKey();
    return NextResponse.json(
      {
        error: isSetup ? LLM_SETUP_ERROR : msg,
        hint: isSetup ? LLM_SETUP_HINT : undefined,
        code: isSetup ? "llm_setup" : undefined,
      },
      { status: 503 },
    );
  }

  try {
    const result = streamText({
      model,
      messages: modelMessages,
      system: systemPrompt,
      maxOutputTokens: streamSpec.maxOutputTokens,
      ...(googleProviderOptionsForApiModel(streamSpec.apiModelId)
        ? { providerOptions: googleProviderOptionsForApiModel(streamSpec.apiModelId) }
        : {}),
      onFinish: async (event) => {
        const failed =
          event.finishReason === "error" ||
          event.finishReason === "content-filter";

        if (failed) {
          await writer.from("ai_usage_logs").insert({
            user_id: user.id,
            user_email: userEmail,
            model_id: billedStreamModelId,
            mode,
            tokens_charged: 0,
            tokens_input: event.usage?.inputTokens ?? null,
            tokens_output: event.usage?.outputTokens ?? null,
            status: "error",
            error_message: `finish:${event.finishReason}`,
            conversation_id: conversationId ?? null,
            operation_id: opId,
          });
          if (buildJobId) {
            await writer
              .from("build_jobs")
              .update({
                status: "failed",
                error_message: `finish:${event.finishReason}`,
              })
              .eq("id", buildJobId);
          }
          return;
        }

        let buildQualityOk = true;
        let outputSaved = true;
        let buildFailureReason: string | null = null;

        if (conversationId && event.text) {
          const { error: asstErr } = await writer.from("messages").insert({
            conversation_id: conversationId,
            user_id: user.id,
            role: "assistant",
            content: event.text,
            model_id: billedStreamModelId,
            credits_used: 0,
            finish_reason: event.finishReason,
            tokens_input: event.usage?.inputTokens ?? null,
            tokens_output: event.usage?.outputTokens ?? null,
            metadata: {
              mode: modeAtSubmit,
              mode_at_submit: modeAtSubmit,
              scope,
              projectId,
              billing: "pending",
            } as never,
          });
          if (asstErr) {
            outputSaved = false;
            buildFailureReason = asstErr.message;
            if (process.env.NODE_ENV !== "production") {
              console.warn("[chat] assistant message insert:", asstErr.message);
            }
          }
        }

        let savedFileCount = 0;
        let savedAppName: string | null = null;
        let savedMeta: ReturnType<typeof extractBuilderMetadata> = null;
        let savedIconSvg: string | null = null;

        if (startBuildPipeline && projectId && event.text) {
          const files = parseFencedFiles(event.text);
          const meta = extractBuilderMetadata(event.text);
          savedMeta = meta;
          let appName =
            meta?.app?.name?.trim() ||
            event.text.match(/##\s*\[planning\][^\n]*\n+([^\n#][^\n]{0,80})/i)?.[1]?.trim() ||
            null;

          if (!appName && userText) {
            appName = userText
              .replace(/^(create|build|make)\s+(me\s+)?(a\s+)?/i, "")
              .split(/[.!?]/)[0]
              ?.trim()
              .slice(0, 48) || null;
          }
          if (!appName && files.length > 0) {
            appName = slugifyAppName(userText || "app").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          }
          if (appName) {
            appName = refineAppName(appName, userText || "");
          }

          if (files.length === 0) {
            buildQualityOk = false;
            buildFailureReason = "No project files generated";
          } else {
            if (!appName) {
              appName = refineAppName(userText || "Dream App", userText || "");
            }
            const quality = validateBuilderOutput(meta, files);
            const fileQuality = validateGeneratedBuild(files);
            const hasPreviewHtml = files.some(
              (f) => /preview\/index\.html$/i.test(f.path) && f.content.length > 150,
            );
            if (!quality.ok && process.env.NODE_ENV !== "production") {
              console.warn("[chat] builder meta quality:", quality.reasons);
            }
            if (!fileQuality.ok && !hasPreviewHtml && process.env.NODE_ENV !== "production") {
              console.warn("[chat] file quality:", fileQuality.reasons);
            }
            {
              const appSlug = meta?.app?.slug?.trim() || slugifyAppName(appName);
              const appDescription = meta?.app?.description?.trim() ?? null;
              const rows = files.map((f) => ({
                project_id: projectId,
                owner_id: projectAccess?.ownerId ?? user.id,
                path: f.path,
                content: f.content,
                language: f.path.split(".").pop() ?? "text",
                mime_type: "text/plain",
                size_bytes: Buffer.byteLength(f.content, "utf8"),
              }));
              const { error: afErr } = await writer.from("app_files").upsert(rows as never, {
                onConflict: "project_id,path",
              });
              if (afErr) {
                buildQualityOk = false;
                outputSaved = false;
                buildFailureReason = afErr.message;
                if (process.env.NODE_ENV !== "production") {
                  console.warn("[chat] app_files upsert:", afErr.message);
                }
              } else {
                savedFileCount = files.length;
                buildQualityOk = true;
                savedAppName = appName;
                const svgIcon = appIconSvgDataUrl(appName, meta?.app?.category);
                savedIconSvg = svgIcon;
                const iconApiUrl = `${getAppUrl().replace(/\/$/, "")}/api/projects/${projectId}/icon`;
                await writer
                  .from("projects")
                  .update({ icon_url: iconApiUrl, app_icon_url: svgIcon } as never)
                  .eq("id", projectId);
                await finalizeBuildSuccess({
                  writer,
                  userId: user.id,
                  projectId,
                  buildJobId,
                  appName,
                  appSlug,
                  appDescription,
                  iconSvg: svgIcon,
                  meta,
                  fileCount: savedFileCount,
                  creditsCharged: 0,
                  charged: false,
                });
                await completeBuildWithValidation({
                  writer,
                  userId: user.id,
                  projectId,
                });
                await allocatePublishedSubdomain(writer, projectId, user.id);

                if (!fileQuality.ok && buildJobId) {
                  const repair = await runBuildQualityRepair({
                    writer,
                    projectId,
                    buildJobId,
                    userId: user.id,
                    files: files.map((f) => ({ path: f.path, content: f.content })),
                    userPrompt: userText,
                    generate: async (repairPrompt) => {
                      const repairSpec = routeOperation({
                      operationType: "code_repair_small",
                      ownerEmail: userEmail,
                    });
                    const { text } = await generateText(
                      withGoogleProviderOptions(repairSpec.apiModelId, {
                        model: resolveModel(repairSpec.apiModelId),
                        maxOutputTokens: repairSpec.maxOutputTokens,
                        system: `${systemPrompt}\n\nRepair pass: fix quality issues only. Return strict JSON file payload.`,
                        prompt: repairPrompt,
                      }),
                    );
                      return text;
                    },
                  });
                  if (repair.repaired) {
                    savedFileCount = repair.fileCount;
                    buildQualityOk = true;
                    buildFailureReason = null;
                  } else if (repair.attempts > 0) {
                    buildQualityOk = false;
                    buildFailureReason =
                      repair.reasons.join("; ") || "Quality repair could not fix all issues";
                  }
                }
              }
            }
          }
        }

        const shouldCharge =
          outputSaved &&
          Boolean(event.text?.trim()) &&
          (chargeMode !== "build" || savedFileCount > 0);

        let charged = false;
        let chargeError: string | null = null;

        const billedUserId = creditBillingTarget?.billedUserId ?? user.id;
        const alreadyCharged = await hasSuccessfulChargeForOperation(writer, billedUserId, opId);

        if (shouldCharge && !alreadyCharged) {
          const chargeCalc = calculateCreditsToCharge({
            modelId: billedStreamModelId,
            mode: chargeMode,
            inputTokens: event.usage?.inputTokens ?? null,
            outputTokens: event.usage?.outputTokens ?? null,
            fileCount: savedFileCount,
          });
          const creditsToCharge = chargeCalc.creditsToCharge;

          console.info("[credits] charge start", {
            operation_id: opId,
            provider: streamProvider,
            model: billedStreamModelId,
            userSelectedModel: requestedModel ?? "automatic",
            mode: chargeMode,
            credits: creditsToCharge,
          });

          const charge = await chargeAiOperation(writer, {
            actorUserId: user.id,
            userId: user.id,
            userEmail,
            amount: creditsToCharge,
            modelId: billedStreamModelId,
            mode: chargeMode,
            operationId: opId,
            conversationId,
            projectId,
            workspaceId: projectAccess?.workspaceId ?? null,
            buildJobId,
            providerCostUsd: chargeCalc.estimatedProviderCostUsd,
            tokensInput: event.usage?.inputTokens ?? null,
            tokensOutput: event.usage?.outputTokens ?? null,
            provider: streamProvider,
            routeReason: manualModelSelection
              ? "user_selected_model"
              : (buildIntent?.reason ?? routed.routeReason ?? null),
            operationType: chargeCalc.operationType,
            minimumFloorApplied: chargeCalc.minimumFloorApplied,
            userCreditsReserved:
              startBuildPipeline ? budgetPlan.creditQuote.userCreditsReserved : null,
          });
          charged = charge.charged;
          chargeError = charge.error ?? null;
          if (charge.charged) {
            console.info("[credits] charge ok", { operation_id: opId, remaining: charge.remaining });
          } else if (charge.idempotent) {
            console.info("[credits] charge skipped idempotent", { operation_id: opId });
          } else {
            console.warn("[credits] charge failed", { operation_id: opId, error: chargeError });
          }

          if (charged && mode === "build" && buildJobId && projectId && savedFileCount > 0) {
            await writer
              .from("build_jobs")
              .update({ credits_charged: creditsToCharge } as never)
              .eq("id", buildJobId);
            if (savedAppName) {
              await finalizeBuildSuccess({
                writer,
                userId: user.id,
                projectId,
                buildJobId,
                appName: savedAppName,
                appSlug: savedMeta?.app?.slug?.trim() ?? null,
                appDescription: savedMeta?.app?.description?.trim() ?? null,
                iconSvg: savedIconSvg,
                meta: savedMeta,
                fileCount: savedFileCount,
                creditsCharged: creditsToCharge,
                charged: true,
              });
            }
          }

          if (charged && conversationId) {
            const { data: lastAsst } = await writer
              .from("messages")
              .select("id")
              .eq("conversation_id", conversationId)
              .eq("role", "assistant")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (lastAsst?.id) {
              await writer
                .from("messages")
                .update({
                  credits_used: creditsToCharge,
                  metadata: { mode, scope, projectId, billing: "finalized", credits: creditsToCharge } as never,
                })
                .eq("id", lastAsst.id);
            }
          } else if (!charged && chargeError && outputSaved) {
            await writer.from("ai_usage_logs").insert({
              user_id: user.id,
              user_email: userEmail,
              model_id: billedStreamModelId,
              mode: chargeMode,
              tokens_charged: 0,
              credits_charged: 0,
              status: "charge_failed",
              error_message: chargeError,
              conversation_id: conversationId ?? null,
              operation_id: opId,
              project_id: projectId ?? null,
            } as never);
            if (process.env.NODE_ENV !== "production") {
              console.warn("[chat] charge after save:", chargeError);
            }
          }
        } else if (!alreadyCharged && outputSaved && event.text?.trim()) {
          const skipReason = buildFailureReason
            ? buildFailureReason
            : mode === "build" && savedFileCount === 0
              ? "Build output not saved — no credits charged"
              : "No charge — skipped";
          if (skipReason.includes("not saved") || skipReason.includes("Build output")) {
            await writer.from("ai_usage_logs").insert({
              user_id: user.id,
              user_email: userEmail,
              model_id: billedStreamModelId,
              mode: chargeMode,
              tokens_charged: 0,
              status: "skipped",
              error_message: skipReason,
              conversation_id: conversationId ?? null,
              operation_id: opId,
              project_id: projectId ?? null,
            } as never);
          }
        }

        if (buildJobId && mode === "build" && !buildQualityOk) {
          await finalizeBuildFailed({
            writer,
            buildJobId,
            projectId: projectId ?? undefined,
            userId: user.id,
            errorMessage:
              buildFailureReason ??
              chargeError ??
              "Build did not meet quality requirements.",
          });
        }

        if (projectId && mode === "edit" && userText) {
          await maybeCreatePendingDiffFromChatEdit({
            writer,
            supabase,
            userId: user.id,
            userEmail,
            projectId,
            conversationId,
            userPrompt: userText,
            mode: "edit",
          }).catch(() => undefined);
        }
      },
    });

    const response = result.toUIMessageStreamResponse();
    if (process.env.NODE_ENV !== "production") {
      response.headers.set("X-DreamOS-Mode", taskMode);
      response.headers.set("X-DreamOS-Model", billedStreamModelId);
      response.headers.set("X-DreamOS-Provider", streamProvider);
      if (manualModelSelection && requestedModel) {
        response.headers.set("X-DreamOS-User-Model", requestedModel);
      }
      response.headers.set("X-DreamOS-Credits-Estimate", String(tokensNeeded));
    }
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Model unavailable";
    const classified = classifyProviderError(err);
    recordProviderFailure(classified.provider, classified.errorClass);
    const userMsg = sanitizeUserFacingAiError(msg);
    await writer.from("ai_usage_logs").insert({
      user_id: user.id,
      user_email: userEmail,
      model_id: streamSpec.modelId,
      mode,
      tokens_charged: 0,
      tokens_input: null,
      tokens_output: null,
      status: "error",
      error_message: msg.slice(0, 500),
      conversation_id: conversationId ?? null,
      operation_id: opId,
    });
    if (buildJobId) {
      await writer
        .from("build_jobs")
        .update({ status: "failed", error_message: msg })
        .eq("id", buildJobId);
    }
    const isSetup = !hasAnyLlmProviderKey();
    return NextResponse.json(
      {
        error: isSetup ? LLM_SETUP_ERROR : userMsg,
        hint: isSetup ? LLM_SETUP_HINT : undefined,
        code: isSetup ? "llm_setup" : undefined,
      },
      { status: 503 },
    );
  }
}
