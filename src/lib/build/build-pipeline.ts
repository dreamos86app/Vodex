import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { scoreTaskScope } from "@/lib/ai/task-scope-limiter";
import { FULL_BUILD_CAP_USD } from "@/lib/ai/cost-budget";
import { callProviderStructured, parseJsonFromModel } from "@/lib/ai/provider-call";
import { parseFencedFiles } from "@/lib/creation/extract-fenced-code";
import { logServerOperation } from "@/lib/ops/server-ops-log";
import { requireId } from "@/lib/diagnostics/require-ids";
import { dreamosLog } from "@/lib/diagnostics/dreamos-logger";
import { generateAppIconSvg } from "@/lib/creation/app-icon-svg";
import type { BuilderOutputContract } from "@/lib/creation/parse-builder-metadata";
import { slugifyAppName } from "@/lib/creation/parse-builder-metadata";
import { validateGeneratedBuild } from "@/lib/creation/validate-build-quality";
import { assessBuildQuality, buildRepairPrompt } from "@/lib/build/quality-repair";
import {
  appIdentityPrompt,
  backendPrompt,
  buildPlanPrompt,
  frontendPrompt,
  minimalFrontendPrompt,
  iconSvgPrompt,
  schemaPrompt,
  uiPlanPrompt,
} from "@/lib/build/stage-prompts";

export type WorkflowEventType =
  | "thinking"
  | "classified"
  | "planning"
  | "identity"
  | "icon"
  | "schema"
  | "designing"
  | "reading"
  | "writing"
  | "editing"
  | "validating"
  | "compiling"
  | "repairing"
  | "saving"
  | "charging"
  | "finalizing"
  | "done"
  | "failed";

export type WorkflowEvent = {
  type: WorkflowEventType;
  label: string;
  detail?: string;
  at: string;
};

export type BuildFile = { path: string; content: string; language?: string };

export type StagedBuildResult = {
  ok: boolean;
  visibleText: string;
  meta: BuilderOutputContract | null;
  iconSvg: string | null;
  files: BuildFile[];
  events: WorkflowEvent[];
  totalProviderCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  primaryModelId: string;
  complexity: number;
  errorMessage?: string;
};

type Writer = SupabaseClient<Database>;

const BUILD_SYSTEM = `You are DreamOS86 build engine. Output strict JSON only when asked. Never exceed token limits.`;

function pushEvent(events: WorkflowEvent[], type: WorkflowEventType, label: string, detail?: string) {
  events.push({ type, label, detail, at: new Date().toISOString() });
}

function normalizeFilePath(path: string): string {
  return path.replace(/^\.?\//, "").replace(/\\/g, "/");
}

function isPageFile(path: string): boolean {
  const p = normalizeFilePath(path);
  return (
    /(^|\/)page\.(tsx|jsx|js)$/i.test(p) ||
    /(^|\/)pages?\//i.test(p) ||
    /index\.html$/i.test(p)
  );
}

function hasRouteFiles(files: BuildFile[]): boolean {
  return files.some((f) => isPageFile(f.path));
}

function parseFilePayload(text: string): { files: BuildFile[]; events: { type: string; path: string; summary: string }[] } | null {
  const parsed = parseJsonFromModel<{
    files?: BuildFile[];
    events?: { type: string; path: string; summary: string }[];
  }>(text);
  if (parsed?.files?.length) {
    return {
      files: parsed.files.filter((f) => f.path && f.content),
      events: parsed.events ?? [],
    };
  }
  const fenced = parseFencedFiles(text);
  if (fenced.length) {
    return {
      files: fenced.filter((f) => f.path && f.content),
      events: fenced.map((f) => ({ type: "wrote", path: f.path, summary: `Wrote ${f.path}` })),
    };
  }
  return null;
}

function buildVisibleNarrative(
  meta: BuilderOutputContract | null,
  workflow: WorkflowEvent[],
  summary: string,
): string {
  const planSteps = meta?.plan ?? meta?.build_plan?.map((p) => p.title) ?? [];
  const lines: string[] = [];

  lines.push("```dreamos-app-meta");
  lines.push(JSON.stringify(meta ?? { summary }, null, 0));
  lines.push("```");
  lines.push("");

  if (planSteps.length) {
    lines.push("## [planning] Build plan");
    for (const s of planSteps.slice(0, 6)) {
      const label = typeof s === "string" ? s : "Step";
      lines.push(`- ${label}`);
    }
    lines.push("");
  }

  for (const ev of workflow.filter((e) => ["writing", "editing", "validating", "repairing", "saving"].includes(e.type))) {
    lines.push(`- ${ev.label}`);
  }

  lines.push("");
  lines.push(summary.slice(0, 600));

  return lines.join("\n");
}

export async function runStagedBuildPipeline(input: {
  writer: Writer;
  userId: string;
  userEmail: string | null;
  operationId: string;
  projectId: string;
  buildJobId: string | null;
  userPrompt: string;
  memoryBlock?: string;
  blueprintBlock?: string;
  conversationId?: string | null;
}): Promise<StagedBuildResult> {
  if (!requireId("projectId", input.projectId, { source: "server", userId: input.userId, buildId: input.buildJobId })) {
    dreamosLog({
      source: "server",
      category: "missing_id",
      severity: "error",
      message: "Staged build aborted — missing projectId",
      userId: input.userId,
      buildId: input.buildJobId,
    });
    return {
      ok: false,
      visibleText: "Build failed: project ID is missing.",
      meta: null,
      iconSvg: null,
      files: [],
      events: [],
      totalProviderCostUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      primaryModelId: "automatic",
      complexity: 1,
      errorMessage: "missing_project_id",
    };
  }

  const events: WorkflowEvent[] = [];
  let accumulatedCost = 0;
  let totalIn = 0;
  let totalOut = 0;
  let primaryModelId = "gpt-5.4-mini";

  const scope = scoreTaskScope(input.userPrompt);
  pushEvent(events, "classified", `Complexity ${scope.complexity}/10`, scope.coreV1Only ? "Core V1 first" : undefined);

  const scopeNote = scope.coreV1Only
    ? `Build Core V1 only. Queue for later: ${scope.backlog.slice(0, 5).join("; ")}`
    : "";

  const planContext = [input.blueprintBlock, input.memoryBlock, scopeNote].filter(Boolean).join("\n\n");

  pushEvent(events, "planning", "Creating build plan");
  const planRes = await callProviderStructured({
    writer: input.writer,
    userId: input.userId,
    userEmail: input.userEmail,
    operationId: `${input.operationId}:plan`,
    operationType: "build_plan",
    system: BUILD_SYSTEM,
    prompt: buildPlanPrompt(input.userPrompt, planContext),
    accumulatedCostUsd: accumulatedCost,
  });
  accumulatedCost += planRes.providerCostUsd;
  totalIn += planRes.inputTokens ?? 0;
  totalOut += planRes.outputTokens ?? 0;
  primaryModelId = planRes.spec.modelId;

  const planJson = planRes.text;
  const planParsed = parseJsonFromModel<{
    complexity?: number;
    summary?: string;
    steps?: string[];
    pages?: string[];
    entities?: string[];
    core_v1_only?: boolean;
    queued_later?: string[];
  }>(planJson);

  const complexity = Math.min(10, planParsed?.complexity ?? scope.complexity);

  pushEvent(events, "identity", "Naming app");
  const idRes = await callProviderStructured({
    writer: input.writer,
    userId: input.userId,
    userEmail: input.userEmail,
    operationId: `${input.operationId}:identity`,
    operationType: "app_identity",
    system: BUILD_SYSTEM,
    prompt: appIdentityPrompt(input.userPrompt, planJson),
    complexity,
    accumulatedCostUsd: accumulatedCost,
  });
  accumulatedCost += idRes.providerCostUsd;
  totalIn += idRes.inputTokens ?? 0;
  totalOut += idRes.outputTokens ?? 0;

  const identity = parseJsonFromModel<{ app?: BuilderOutputContract["app"] }>(idRes.text);
  const appName = identity?.app?.name?.replace(/\*\*/g, "").trim() || "Dream App";
  const appSlug = identity?.app?.slug?.trim() || slugifyAppName(appName);
  const category = identity?.app?.category?.trim() || "productivity";

  pushEvent(events, "icon", "Generating app icon");
  let iconSvg = "";
  try {
    const iconRes = await callProviderStructured({
      writer: input.writer,
      userId: input.userId,
      userEmail: input.userEmail,
      operationId: `${input.operationId}:icon`,
      operationType: "icon_svg_generation",
      system: BUILD_SYSTEM,
      prompt: iconSvgPrompt(appName, category),
      accumulatedCostUsd: accumulatedCost,
    });
    accumulatedCost += iconRes.providerCostUsd;
    const iconParsed = parseJsonFromModel<{ icon_svg?: string }>(iconRes.text);
    iconSvg = iconParsed?.icon_svg?.trim() ?? "";
  } catch {
    /* fallback below */
  }
  if (!iconSvg.startsWith("<svg")) {
    iconSvg = generateAppIconSvg(appName, category);
  }

  pushEvent(events, "schema", "Designing data schema");
  const schemaRes = await callProviderStructured({
    writer: input.writer,
    userId: input.userId,
    userEmail: input.userEmail,
    operationId: `${input.operationId}:schema`,
    operationType: "schema_design",
    system: BUILD_SYSTEM,
    prompt: schemaPrompt(planJson),
    complexity,
    accumulatedCostUsd: accumulatedCost,
  });
  accumulatedCost += schemaRes.providerCostUsd;
  const schemaJson = schemaRes.text;

  pushEvent(events, "designing", "Planning UI");
  const uiRes = await callProviderStructured({
    writer: input.writer,
    userId: input.userId,
    userEmail: input.userEmail,
    operationId: `${input.operationId}:ui`,
    operationType: "ui_design_plan",
    system: BUILD_SYSTEM,
    prompt: uiPlanPrompt(planJson, schemaJson, input.userPrompt),
    complexity,
    accumulatedCostUsd: accumulatedCost,
  });
  accumulatedCost += uiRes.providerCostUsd;
  const uiJson = uiRes.text;

  if (accumulatedCost >= FULL_BUILD_CAP_USD * 0.85) {
    return {
      ok: false,
      visibleText: "This build is too large for one pass. I staged the core plan — continue with a follow-up prompt for the next features.",
      meta: null,
      iconSvg: null,
      files: [],
      events,
      totalProviderCostUsd: accumulatedCost,
      totalInputTokens: totalIn,
      totalOutputTokens: totalOut,
      primaryModelId,
      complexity,
      errorMessage: "build_budget_precheck",
    };
  }

  pushEvent(events, "writing", "Generating frontend files");
  const smokeBuild = process.env.DREAMOS_SMOKE_BUILD === "1";
  const fePrompt = smokeBuild
    ? minimalFrontendPrompt(input.userPrompt, planJson)
    : frontendPrompt(input.userPrompt, planJson, uiJson, scope.maxFiles);
  const feRes = await callProviderStructured({
    writer: input.writer,
    userId: input.userId,
    userEmail: input.userEmail,
    operationId: `${input.operationId}:frontend`,
    operationType: "frontend_implementation",
    system: BUILD_SYSTEM,
    prompt: fePrompt,
    complexity: smokeBuild ? 3 : complexity,
    accumulatedCostUsd: accumulatedCost,
  });
  accumulatedCost += feRes.providerCostUsd;
  totalIn += feRes.inputTokens ?? 0;
  totalOut += feRes.outputTokens ?? 0;
  primaryModelId = feRes.spec.modelId;

  let allFiles: BuildFile[] = [];
  const fePayload = parseFilePayload(feRes.text);
  if (fePayload) {
    allFiles = fePayload.files.slice(0, scope.maxFiles);
    for (const ev of fePayload.events.slice(0, 12)) {
      pushEvent(events, "writing", ev.summary || `Wrote ${ev.path}`, ev.path);
    }
  }

  if (!hasRouteFiles(allFiles) && accumulatedCost < FULL_BUILD_CAP_USD * 0.92) {
    pushEvent(events, "writing", "Retrying with compact route set");
    const miniRes = await callProviderStructured({
      writer: input.writer,
      userId: input.userId,
      userEmail: input.userEmail,
      operationId: `${input.operationId}:frontend-mini`,
      operationType: "frontend_implementation",
      system: BUILD_SYSTEM,
      prompt: minimalFrontendPrompt(input.userPrompt, planJson),
      complexity: 4,
      accumulatedCostUsd: accumulatedCost,
    });
    accumulatedCost += miniRes.providerCostUsd;
    const miniPayload = parseFilePayload(miniRes.text);
    if (miniPayload?.files.length) {
      const merged = new Map(allFiles.map((f) => [f.path, f]));
      for (const f of miniPayload.files) merged.set(f.path, f);
      allFiles = [...merged.values()].slice(0, scope.maxFiles);
    }
  }

  if (complexity >= 7 && hasRouteFiles(allFiles) && accumulatedCost < FULL_BUILD_CAP_USD * 0.9) {
    pushEvent(events, "writing", "Generating backend files");
    try {
      const beRes = await callProviderStructured({
        writer: input.writer,
        userId: input.userId,
        userEmail: input.userEmail,
        operationId: `${input.operationId}:backend`,
        operationType: "backend_implementation",
        system: BUILD_SYSTEM,
        prompt: backendPrompt(planJson, schemaJson),
        complexity,
        accumulatedCostUsd: accumulatedCost,
      });
      accumulatedCost += beRes.providerCostUsd;
      const bePayload = parseFilePayload(beRes.text);
      if (bePayload) {
        const merged = new Map(allFiles.map((f) => [f.path, f]));
        for (const f of bePayload.files) merged.set(f.path, f);
        allFiles = [...merged.values()].slice(0, scope.maxFiles);
      }
    } catch {
      /* backend optional */
    }
  }

  pushEvent(events, "validating", `Validating ${allFiles.length} files`);
  let quality = assessBuildQuality(allFiles);
  let repairAttempts = 0;

  while (!quality.ok && repairAttempts < 2 && accumulatedCost < FULL_BUILD_CAP_USD) {
    pushEvent(events, "repairing", `Repair pass ${repairAttempts + 1}`);
    const repairRes = await callProviderStructured({
      writer: input.writer,
      userId: input.userId,
      userEmail: input.userEmail,
      operationId: `${input.operationId}:repair:${repairAttempts}`,
      operationType: repairAttempts === 0 ? "code_repair_small" : "code_repair_hard",
      system: BUILD_SYSTEM,
      prompt: buildRepairPrompt(quality.reasons, allFiles, input.userPrompt),
      complexity,
      accumulatedCostUsd: accumulatedCost,
    });
    accumulatedCost += repairRes.providerCostUsd;
    const repaired = parseFilePayload(repairRes.text);
    if (repaired?.files.length) {
      const merged = new Map(allFiles.map((f) => [f.path, f]));
      for (const f of repaired.files) merged.set(f.path, f);
      allFiles = [...merged.values()];
    }
    quality = assessBuildQuality(allFiles);
    repairAttempts += 1;
  }

  pushEvent(events, "compiling", "Preview compile check");
  const fileQuality = validateGeneratedBuild(allFiles);
  const ok = allFiles.length > 0 && (quality.ok || fileQuality.ok);

  const meta: BuilderOutputContract = {
    app: {
      name: appName,
      slug: appSlug,
      description: identity?.app?.description ?? planParsed?.summary ?? "",
      category,
      theme: identity?.app?.theme,
    },
    build_plan: (planParsed?.steps ?? []).slice(0, 6).map((title, i) => ({
      id: `step-${i}`,
      title: String(title),
      summary: "",
    })),
    plan: planParsed?.steps ?? [],
    pages: (planParsed?.pages ?? []).map((p) => ({ id: slugifyAppName(String(p)), title: String(p) })),
    entities: [],
    files: allFiles.map((f) => ({ path: f.path, action: "created" as const })),
    summary: ok
      ? `Built ${appName} with ${allFiles.length} files.`
      : "Build completed with quality warnings.",
    dashboard: undefined,
    publish: undefined,
    preview: undefined,
    steps: [],
  };

  if (scope.coreV1Only && scope.backlog.length) {
    meta.summary = `${meta.summary} Remaining items are queued as next steps.`;
  }

  const summary = meta.summary ?? "";
  if (ok) pushEvent(events, "done", summary);
  else pushEvent(events, "failed", quality.reasons.join("; ") || "No files generated");

  if (input.buildJobId) {
    const pipelineMeta = {
      pipeline: "staged",
      complexity,
      provider_cost_usd: accumulatedCost,
      workflow_events: events as unknown as Json,
    } as Json;
    const { error: metaErr } = await input.writer
      .from("build_jobs")
      .update({ meta: pipelineMeta } as never)
      .eq("id", input.buildJobId);
    if (metaErr?.message?.includes("meta")) {
      await input.writer
        .from("build_jobs")
        .update({ metadata: pipelineMeta } as never)
        .eq("id", input.buildJobId);
    }
  }

  await logServerOperation({
    writer: input.writer,
    userId: input.userId,
    userEmail: input.userEmail,
    stage: "build",
    event: ok ? "build_pipeline_success" : "build_pipeline_failed",
    status: ok ? "ok" : "error",
    projectId: input.projectId,
    operationId: input.operationId,
    metadata: {
      files: allFiles.length,
      provider_cost_usd: accumulatedCost,
      output_tokens: totalOut,
    },
  });

  return {
    ok,
    visibleText: buildVisibleNarrative(meta, events, summary),
    meta,
    iconSvg: iconSvg || null,
    files: allFiles,
    events,
    totalProviderCostUsd: accumulatedCost,
    totalInputTokens: totalIn,
    totalOutputTokens: totalOut,
    primaryModelId,
    complexity,
    errorMessage: ok ? undefined : quality.reasons.join("; ") || "build_failed",
  };
}
