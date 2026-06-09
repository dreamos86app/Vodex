import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { scoreTaskScope } from "@/lib/ai/task-scope-limiter";
import {
  buildIntakeFromPrompt,
  processHugePromptIntake,
  resolveHeavyExecutionBrief,
  type HugePromptIntakeResult,
} from "@/lib/ai/huge-prompt-intake";
import {
  createBuildContextSlices,
  HeavyInputBudgetTracker,
  type BuildContextSlices,
} from "@/lib/build/heavy-input-budget";
import { loadBuildBacklog } from "@/lib/build/build-backlog";
import {
  formatBuildResultSummary,
  renderBuildResultMarkdown,
} from "@/lib/build/build-continuation-plan";
import { FULL_BUILD_CAP_USD } from "@/lib/ai/cost-budget";
import { callProviderStructured, parseJsonFromModel } from "@/lib/ai/provider-call";
import { parseBuildFilesFromModel } from "@/lib/build/parse-build-files";
import {
  countRenderablePages,
  filterRenderableBuildFiles,
  hasRouteFiles,
  type BuildFile,
} from "@/lib/build/generated-file-utils";
import type { BuildSuccessContractResult } from "@/lib/build/build-success-contract";
import {
  enforcePostBuildContractWithRepair,
  requiredPageSlugsForArchetype,
} from "@/lib/build/post-build-contract";
import {
  applyArchetypeScaffoldFallback,
  hasFullScaffoldTree,
  isModelOutputSufficient,
  replaceStubFilesWithArchetypeScaffold,
} from "@/lib/build/archetype-scaffold-fallback";
import {
  thinkingForArchetypeRoutes,
  thinkingForDesignBrief,
  thinkingForFrontendFailed,
  thinkingForFrontendRetry,
  thinkingForFrontendStart,
  thinkingForIconStatus,
  thinkingForQualityCheck,
} from "@/lib/build/build-thinking-messages";
import { expandBuildPromptIfShallow } from "@/lib/build/build-feature-expansion";
import { expandProductIntelligence } from "@/lib/build/product-intelligence-expansion";
import {
  buildDeterministicPlanForArchetype,
  deterministicPlanToJson,
  hasDeterministicArchetypePlan,
} from "@/lib/build/deterministic-archetype-plan";
import { callProviderWithBuildTimeout, withTimeout } from "@/lib/build/timed-build-operations";
import {
  callProviderWithModelHeartbeat,
  emitBuildHeartbeat,
} from "@/lib/build/model-call-heartbeat";
import { runChunkedFrontendGeneration } from "@/lib/build/chunked-generation-pipeline";
import { runRouteByRouteGeneration } from "@/lib/build/route-by-route-generation";
import { CHUNK_MODEL_TIMEOUT_MS } from "@/lib/ai/provider-timeouts";
import { buildDomainOpenerFromPrompt } from "@/lib/build/build-domain-narration";
import {
  clearBuildContinuationStatePatch,
  readBuildContinuationState,
  writeBuildContinuationStatePatch,
} from "@/lib/build/build-continuation-state";
import { userContinuationProgressLine } from "@/lib/build/build-user-copy";
import { userMessageForTimeoutStrategy as timeoutUserMessage } from "@/lib/build/model-timeout-strategy";
import {
  MAX_SAFE_CONTINUATION_ATTEMPTS,
  type BuildTerminalPhase,
} from "@/lib/build/build-terminal-state-machine";
import { normalizeAppRouterBuildFiles } from "@/lib/build/app-router-route-normalizer";
import {
  evaluateSourceIntegrity,
  isPortfolioBuildPrompt,
} from "@/lib/build/source-integrity-validator";
import { repairRootPageContent, rootPageContentOk } from "@/lib/build/root-page-repair";
import { mergePortfolioScaffold } from "@/lib/build/portfolio-scaffold";
import { resolveModelMix } from "@/lib/ai/model-mix-router";
import type {
  BuildWorkerTraceSnapshot,
  BuildWorkerTraceStage,
} from "@/lib/build/build-worker-trace";
import {
  persistTraceStage,
  traceBuildWorkerStage,
} from "@/lib/build/build-worker-trace";
import { PROVIDER_TIMEOUT_MS } from "@/lib/ai/provider-timeouts";
import { appIconSvgDataUrl } from "@/lib/creation/app-icon-svg";
import { resolveModelRuntime } from "@/lib/ai/model-catalog";
import { isAutomaticModelId } from "@/lib/ai/resolve-automatic-model";
import { logServerOperation } from "@/lib/ops/server-ops-log";
import { requireId } from "@/lib/diagnostics/require-ids";
import { dreamosLog } from "@/lib/diagnostics/dreamos-logger";
import {
  createAppIdentityForBuild,
  type AppIdentityResult,
} from "@/lib/projects/app-identity-service";
import type { BuilderOutputContract } from "@/lib/creation/parse-builder-metadata";
import { slugifyAppName } from "@/lib/creation/parse-builder-metadata";
import { validateGeneratedBuild } from "@/lib/creation/validate-build-quality";
import { assessBuildQuality, buildRepairPrompt } from "@/lib/build/quality-repair";
import {
  classifyAppArchetype,
  type AppArchetype,
  archetypeToLegacyAppType,
} from "@/lib/build/app-archetype-classifier";
import { resolveBuildArchetype } from "@/lib/build/resolve-build-archetype";
import { buildDesignBrief, type DesignBrief } from "@/lib/build/design-brief-generator";
import { checkGeneratedUiQuality, previewReadyMinScore } from "@/lib/build/generated-ui-quality-checker";
import { buildPremiumUiRepairPrompt } from "@/lib/build/generated-ui-repair-pass";
import {
  backendPrompt,
  buildPlanPrompt,
  compactRouteRetryPrompt,
  frontendPrompt,
  minimalFrontendPrompt,
  schemaPrompt,
  uiPlanPrompt,
} from "@/lib/build/stage-prompts";
import { computeFileLineMeta, type FileLineMeta } from "@/lib/build/file-line-counts";
import {
  userFacingArchetypeLabel,
  userFacingRepairPassLabel,
} from "@/lib/workflow/user-facing-workflow-events";
import {
  resolveFullAppGenerationPlan,
  type FullAppGenerationBudget,
} from "@/lib/build/full-app-generation-plan";
import {
  scoreGeneratedAppQuality,
  formatQualitySummaryForStream,
  type GeneratedAppQualityReport,
} from "@/lib/build/generated-app-quality-score";
import {
  buildAntiScaffoldContinuationPrompt,
  buildContinuationFrontendPrompt,
  continuationUserMessage,
  shouldContinueGeneration,
} from "@/lib/build/generation-continuation";
import {
  createBuildTraceCollector,
  computeStreamHealthFromEvents,
  finalizeBuildTraceArtifact,
  persistBuildTraceArtifact,
} from "@/lib/build/build-trace-artifact";
import {
  formatMissingImportsForSummary,
  repairGeneratedImportGraph,
} from "@/lib/build/generated-import-repair";
import { checkRouteConnectivity } from "@/lib/build/route-connectivity-check";
import { runBuildStage } from "@/lib/build/build-stage-orchestrator";
import { streamExtractBuildFiles } from "@/lib/build/extraction-file-stream";
import { routeToPlannedFilePath, uniquePlannedFilePaths } from "@/lib/build/planned-route-file-path";
import {
  scoreMeaningfulUiQuality,
} from "@/lib/build/meaningful-ui-quality";
import { isSmokeBuildMode, isProductionBuildMode } from "@/lib/build/build-production-mode";
import {
  detectGenericScaffoldBuild,
  genericScaffoldFailureCode,
} from "@/lib/build/generic-scaffold-detector";
import { buildSummaryFromQuality } from "@/lib/build/build-final-summary";

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

export type WorkflowEventMeta = {
  filePath?: string;
  fileLineMeta?: import("@/lib/build/file-line-counts").FileLineMeta;
  streamCategory?: string;
  build_stage?: string;
  stage_status?: string;
  stage_started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  model_used?: string;
  provider_used?: string;
  actual_operation_id?: string;
  honest?: boolean;
  heartbeat?: boolean;
  build_terminal_phase?: string;
  continuation_attempt?: number;
  continuation_max?: number;
  stream_mode?: "model_stream" | "extraction_stream";
  extraction_stream?: boolean;
  file_rewritten?: boolean;
  file_in_progress?: boolean;
  generation_chunk_id?: string;
  generation_chunk_index?: number;
  generation_chunk_total?: number;
  generation_chunk_label?: string;
  chunk_progress_line?: string;
  chunk_complete?: boolean;
  files_from_chunk?: number;
  active_work?: boolean;
  diagnostics_only?: boolean;
};

export type WorkflowEvent = {
  type: WorkflowEventType;
  label: string;
  detail?: string;
  at: string;
  meta?: WorkflowEventMeta;
};

export type StagedBuildResult = {
  ok: boolean;
  visibleText: string;
  meta: BuilderOutputContract | null;
  iconSvg: string | null;
  iconUrl: string | null;
  appName: string;
  files: BuildFile[];
  events: WorkflowEvent[];
  totalProviderCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  primaryModelId: string;
  complexity: number;
  uiQualityScore: number;
  dashboardQualityScore: number;
  uiRichnessPasses: boolean;
  buildContract: BuildSuccessContractResult;
  /** Full post-build contract failures (includes ui_quality, routes, imports). */
  postBuildFailures: string[];
  appArchetype: string;
  errorMessage?: string;
  scaffoldFallbackUsed?: boolean;
  scaffoldFallbackReason?: string;
  filesBeforeScaffoldFallback?: number;
  filesAfterScaffoldFallback?: number;
  partialCreditStop?: boolean;
  generationQualityReport?: GeneratedAppQualityReport;
  meaningfulQualityReport?: import("@/lib/build/meaningful-ui-quality").MeaningfulUiQualityReport;
  genericScaffoldDetection?: import("@/lib/build/generic-scaffold-detector").GenericScaffoldDetection;
  generationBudget?: FullAppGenerationBudget;
  buildFinalSummary?: string;
  modelFilesCount?: number;
  scaffoldFilesCount?: number;
};

type Writer = SupabaseClient<Database>;

const BUILD_SYSTEM = `You are Vodex build engine. Output strict JSON only when asked. Never exceed token limits.`;

const MAX_USER_CONTINUATION_PASSES = 2;

async function loadProjectMeta(writer: Writer, projectId: string): Promise<Record<string, unknown>> {
  const { data } = await writer.from("projects").select("metadata").eq("id", projectId).maybeSingle();
  const meta = data?.metadata;
  return meta && typeof meta === "object" && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
}

async function loadContinuationMeta(writer: Writer, projectId: string) {
  return readBuildContinuationState(await loadProjectMeta(writer, projectId));
}

async function loadPersistedBuildFiles(writer: Writer, projectId: string): Promise<BuildFile[]> {
  const { data } = await writer
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId);
  return (data ?? [])
    .filter((row) => typeof row.path === "string")
    .map((row) => ({ path: row.path as string, content: (row.content as string | null) ?? "" }));
}

function appendWorkflowEvent(
  events: WorkflowEvent[],
  type: WorkflowEventType,
  label: string,
  detail?: string,
  onWorkflowEvent?: (ev: WorkflowEvent) => void | Promise<void>,
  meta?: WorkflowEventMeta,
) {
  const row: WorkflowEvent = {
    type,
    label,
    detail,
    at: new Date().toISOString(),
    meta,
  };
  events.push(row);
  void onWorkflowEvent?.(row);
}

function trackAssistant(
  events: WorkflowEvent[],
  message: string,
  onWorkflowEvent?: (ev: WorkflowEvent) => void | Promise<void>,
) {
  appendWorkflowEvent(events, "thinking", message, undefined, onWorkflowEvent, {
    streamCategory: "assistant_message",
  });
}

function mergeIncomingBuildFiles(
  existing: BuildFile[],
  incoming: BuildFile[],
  events: WorkflowEvent[],
  trackFn: (
    events: WorkflowEvent[],
    type: WorkflowEventType,
    label: string,
    detail?: string,
    meta?: WorkflowEventMeta,
  ) => void,
  maxFiles: number,
  onFileStreamStart?: (path: string) => void,
): BuildFile[] {
  const merged = new Map(existing.map((f) => [f.path, f]));
  for (const f of filterRenderableBuildFiles(incoming)) {
    const prev = merged.get(f.path);
    const fileLineMeta = computeFileLineMeta(prev?.content, f.content);
    const path = f.path;
    const meta: WorkflowEventMeta = {
      filePath: path,
      stream_mode: "extraction_stream",
      extraction_stream: true,
      honest: true,
      ...(fileLineMeta ? { fileLineMeta } : {}),
    };
    const countDetail = fileLineMeta
      ? `+${fileLineMeta.added_lines} -${fileLineMeta.removed_lines}`
      : path;
    if (prev) {
      const rewritten =
        fileLineMeta &&
        (fileLineMeta.added_lines + fileLineMeta.removed_lines >= 8 ||
          fileLineMeta.added_lines >= 40);
      trackFn(
        events,
        "editing",
        rewritten ? `file_rewritten ${path}` : `Modified ${path}`,
        countDetail,
        { ...meta, file_rewritten: rewritten || undefined },
      );
    } else {
      onFileStreamStart?.(path);
      trackFn(events, "writing", `Created ${path}`, countDetail, {
        ...meta,
        file_in_progress: false,
      });
    }
    merged.set(f.path, f);
  }
  return [...merged.values()].slice(0, maxFiles);
}

function parseFilePayload(text: string) {
  return parseBuildFilesFromModel(text);
}

async function ingestModelFilesWithExtractionStream(
  text: string,
  allFiles: BuildFile[],
  events: WorkflowEvent[],
  trackFn: (
    events: WorkflowEvent[],
    type: WorkflowEventType,
    label: string,
    detail?: string,
    meta?: WorkflowEventMeta,
  ) => void,
  maxFiles: number,
  onFileStreamStart?: (path: string) => void,
  onFileStreamDelta?: (path: string, added: number, removed: number, current?: number) => void,
  onFileStreamComplete?: (
    path: string,
    added: number,
    removed: number,
    current: number,
  ) => void,
  onExtractStart?: () => void,
): Promise<BuildFile[]> {
  onExtractStart?.();
  const existingByPath = new Map(allFiles.map((f) => [f.path, f.content]));
  let merged = [...allFiles];
  await streamExtractBuildFiles(
    text,
    {
      onEvent: async (ev) => {
        if (ev.type === "file_started") onFileStreamStart?.(ev.path);
        if (ev.type === "file_delta") {
          onFileStreamDelta?.(ev.path, ev.lines_added, ev.lines_removed, ev.current_line_count);
        }
        if (ev.type === "file_completed") {
          onFileStreamComplete?.(
            ev.path,
            ev.lines_added,
            ev.lines_removed,
            ev.current_line_count,
          );
        }
      },
      onFile: async (f) => {
        merged = mergeIncomingBuildFiles(merged, [f], events, trackFn, maxFiles, onFileStreamStart);
      },
    },
    {
      existingByPath,
      interFileDelayMs: isProductionBuildMode() ? 720 : 140,
      liveDeltaTickMs: 1000,
    },
  );
  return merged;
}

function buildVisibleNarrative(
  meta: BuilderOutputContract | null,
  workflow: WorkflowEvent[],
  summary: string,
  savedFiles: BuildFile[],
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

  if (savedFiles.length > 0) {
    lines.push("");
    lines.push("Files saved:");
    for (const f of savedFiles.slice(0, 14)) {
      lines.push(`- ${f.path}`);
    }
    if (savedFiles.length > 14) lines.push(`- …and ${savedFiles.length - 14} more`);
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
  userSelectedModelId?: string | null;
  onWorkflowEvent?: (ev: WorkflowEvent) => void | Promise<void>;
  buildTrace?: BuildWorkerTraceSnapshot | null;
  /** When true, pipeline may return early with files saved for partial credit builds. */
  shouldStopForCredits?: () => boolean;
  /** Resume route-by-route continuation without replanning or identity. */
  resumeContinuation?: boolean;
  routeByRouteOnly?: boolean;
}): Promise<StagedBuildResult> {
  const emit = input.onWorkflowEvent;
  const track = (
    events: WorkflowEvent[],
    type: WorkflowEventType,
    label: string,
    detail?: string,
    meta?: WorkflowEventMeta,
  ) => appendWorkflowEvent(events, type, label, detail, emit, meta);
  let continuationAttemptsTotal = 0;
  let currentBuildPhase: BuildTerminalPhase = "planning";
  const setBuildPhase = (
    phase: BuildTerminalPhase,
    type: WorkflowEventType,
    label: string,
    detail?: string,
    extra?: WorkflowEventMeta,
  ) => {
    currentBuildPhase = phase;
    track(events, type, label, detail, {
      build_terminal_phase: phase,
      streamCategory: "phase_progress",
      ...extra,
    });
  };
  const modelHeartbeat = (
    callInput: Parameters<typeof callProviderWithModelHeartbeat>[0],
    waitingOn: string,
    attempt: number,
  ) =>
    callProviderWithModelHeartbeat(callInput, {
      trace: input.buildTrace,
      phase: currentBuildPhase,
      attempt,
      maxAttempts: MAX_SAFE_CONTINUATION_ATTEMPTS,
      waitingOn,
      onHeartbeat: (message, elapsedMs) => {
        emitBuildHeartbeat(events as Parameters<typeof emitBuildHeartbeat>[0], message, emit as never, {
          build_terminal_phase: currentBuildPhase,
          continuation_attempt: attempt,
          continuation_max: MAX_SAFE_CONTINUATION_ATTEMPTS,
          heartbeat_elapsed_ms: elapsedMs,
        });
      },
    });
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
      iconUrl: null,
      appName: "Dream App",
      uiQualityScore: 0,
      dashboardQualityScore: 0,
      uiRichnessPasses: false,
      buildContract: {
        passed: false,
        allowed: false,
        failures: ["missing_project_id"],
        renderableCount: 0,
        pageCount: 0,
        uiQualityScore: 0,
        previewReady: false,
        userMessage: "Build failed.",
      },
      appArchetype: "unknown",
      postBuildFailures: ["missing_project_id"],
    };
  }

  const events: WorkflowEvent[] = [];
  const pipelineStartedAt = Date.now();
  const traceCollector = input.buildJobId
    ? createBuildTraceCollector({
        buildJobId: input.buildJobId,
        projectId: input.projectId,
        prompt: input.userPrompt,
      })
    : null;
  const startedFilePaths = new Map<string, string>();
  const onFileStreamStart = (path: string) => {
    const key = path.replace(/\\/g, "/").toLowerCase();
    if (startedFilePaths.has(key)) return;
    startedFilePaths.set(key, path);
    track(events, "writing", path, `Writing ${path}`, {
      filePath: path,
      streamCategory: "file_created",
      extraction_stream: true,
      file_in_progress: true,
      honest: true,
    });
  };
  const onFileStreamDelta = (path: string, added: number, removed: number, current?: number) => {
    track(events, "writing", path, `+${added} -${removed}`, {
      filePath: path,
      streamCategory: "file_created",
      extraction_stream: true,
      file_in_progress: true,
      fileLineMeta: {
        added_lines: added,
        removed_lines: removed,
        old_line_count: Math.max(0, (current ?? added) - added),
        new_line_count: current ?? added,
      },
      honest: true,
    });
  };
  const onFileStreamComplete = (path: string, added: number, removed: number, current: number) => {
    track(events, "writing", `Created ${path}`, `+${added} -${removed}`, {
      filePath: path,
      streamCategory: "file_created",
      extraction_stream: true,
      file_in_progress: false,
      fileLineMeta: {
        added_lines: added,
        removed_lines: removed,
        old_line_count: Math.max(0, current - added),
        new_line_count: current,
      },
      honest: true,
    });
  };
  const clearStalePlannedPlaceholders = (savedFiles: BuildFile[]) => {
    const saved = new Set(savedFiles.map((f) => f.path.replace(/\\/g, "/").toLowerCase()));
    for (const [key, path] of startedFilePaths) {
      if (saved.has(key)) continue;
      track(events, "writing", path, path, {
        filePath: path,
        streamCategory: "file_created",
        extraction_stream: true,
        file_in_progress: false,
        honest: true,
      });
    }
  };
  const onExtractStart = () =>
    trackAssistant(events, "Model response received — extracting files…", emit);
  let accumulatedCost = 0;
  let totalIn = 0;
  let totalOut = 0;
  let primaryModelId = "gpt-5.4-mini";

  const featureExpansion = expandBuildPromptIfShallow(input.userPrompt);
  const productIntel = expandProductIntelligence({
    userPrompt: input.userPrompt,
    executionPrompt: featureExpansion.executionPrompt,
    archetypeId: featureExpansion.archetypeId,
  });
  const pipelinePrompt = productIntel.executionPrompt;
  track(events, "planning", "Understanding product & workflows");
  if (!input.resumeContinuation) {
    trackAssistant(events, buildDomainOpenerFromPrompt(input.userPrompt), emit);
  } else {
    trackAssistant(events, "Continuing generation from where we left off — route-by-route.", emit);
    await input.writer
      .from("projects")
      .update({
        metadata: {
          ...(await loadProjectMeta(input.writer, input.projectId)),
          ...clearBuildContinuationStatePatch(),
        } as Json,
      } as never)
      .eq("id", input.projectId);
  }
  if (featureExpansion.expanded) {
    dreamosLog({
      source: "server",
      category: "build",
      severity: "info",
      message: "Expanded shallow build prompt into MVP feature brief",
      userId: input.userId,
      buildId: input.buildJobId,
      metadata: {
        archetype: featureExpansion.archetypeId,
        added_features: featureExpansion.addedFeatures.length,
      },
    });
  }

  const archetypeEarly: AppArchetype = resolveBuildArchetype({
    buildIntent: pipelinePrompt,
    blueprintBlock: input.blueprintBlock,
  });
  const knownArchetypeFastPath = hasDeterministicArchetypePlan(archetypeEarly.id);

  const tracePersist = async (stage: BuildWorkerTraceStage, detail?: string) => {
    if (!input.buildTrace || !input.buildJobId) return;
    await persistTraceStage(input.writer, {
      jobId: input.buildJobId,
      projectId: input.projectId,
      userId: input.userId,
      snap: input.buildTrace,
      stage,
      detail,
    }).catch(() => undefined);
  };

  if (input.buildTrace) {
    traceBuildWorkerStage(input.buildTrace, "preflight_started");
    await tracePersist("preflight_started");
  }

  let intakeResult: HugePromptIntakeResult | null = null;
  if (input.resumeContinuation || knownArchetypeFastPath) {
    intakeResult = buildIntakeFromPrompt(pipelinePrompt);
  } else {
    try {
      const intakeRace = await withTimeout(
        processHugePromptIntake({
          writer: input.writer,
          userId: input.userId,
          userEmail: input.userEmail,
          projectId: input.projectId,
          operationId: input.operationId,
          rawPrompt: pipelinePrompt,
          userSelectedModelId: input.userSelectedModelId,
        }),
        PROVIDER_TIMEOUT_MS.build_intake ?? 30_000,
        "build_intake",
      );
      if (intakeRace.ok) {
        intakeResult = intakeRace.value;
        accumulatedCost += intakeResult.intakeProviderCostUsd;
      } else {
        intakeResult = buildIntakeFromPrompt(pipelinePrompt);
      }
    } catch {
      intakeResult = buildIntakeFromPrompt(pipelinePrompt);
    }
  }

  if (input.buildTrace) {
    traceBuildWorkerStage(input.buildTrace, "preflight_completed");
  }

  const executionPrompt = resolveHeavyExecutionBrief(pipelinePrompt, intakeResult);
  const firstPassScope = intakeResult?.firstPassScope;
  const heavyBudget = new HeavyInputBudgetTracker();

  const scope = scoreTaskScope(executionPrompt);
  const generationBudget = resolveFullAppGenerationPlan({
    prompt: executionPrompt,
    complexity: firstPassScope?.complexity ?? scope.complexity,
    intake: intakeResult?.summary ?? null,
  });
  const effectiveComplexity = generationBudget.complexity;
  const effectiveMaxFiles = Math.max(
    generationBudget.maxFiles,
    firstPassScope?.maxFiles ?? scope.maxFiles,
  );

  const primaryMix = resolveModelMix({
    operationType: "frontend_implementation",
    userSelectedModelId: input.userSelectedModelId,
    complexity: effectiveComplexity,
    ownerEmail: input.userEmail,
  });
  primaryModelId = primaryMix.mainModelId;

  trackAssistant(events, userFacingArchetypeLabel(archetypeEarly.label), emit);

  const scopeNote = firstPassScope
    ? firstPassScope.scopeNote
    : scope.coreV1Only
      ? `Build Core V1 only. Queue for later: ${scope.backlog.slice(0, 5).join("; ")}`
      : "";

  let contextSlices: BuildContextSlices = createBuildContextSlices(
    executionPrompt,
    scopeNote,
    input.operationId,
  );

  const planContext = [input.blueprintBlock, input.memoryBlock, scopeNote].filter(Boolean).join("\n\n");

  const archetype = archetypeEarly;
  let deterministicPlanUsed = knownArchetypeFastPath;
  let planJson = "";
  let planParsed = buildDeterministicPlanForArchetype(archetype, executionPrompt);

  if (knownArchetypeFastPath || input.resumeContinuation) {
    const det = buildDeterministicPlanForArchetype(archetype, executionPrompt);
    planParsed = det;
    planJson = deterministicPlanToJson(det);
    track(events, "planning", input.resumeContinuation ? "Resuming build plan" : "Creating the app structure…");
    if (input.buildTrace) {
      traceBuildWorkerStage(input.buildTrace, "deterministic_plan_fallback_used", archetype.id);
      await tracePersist("deterministic_plan_fallback_used", archetype.id);
    }
  } else {
    track(events, "planning", "Designing routes and screens");
  }

  if (!knownArchetypeFastPath && !input.resumeContinuation) {
    const planPrompt = buildPlanPrompt(executionPrompt, planContext, contextSlices);
    heavyBudget.record([planPrompt, BUILD_SYSTEM]);
    heavyBudget.assertWithinBudget();
    const planCall = await callProviderWithBuildTimeout(
      {
        writer: input.writer,
        userId: input.userId,
        userEmail: input.userEmail,
        operationId: `${input.operationId}:plan`,
        operationType: "build_plan",
        system: BUILD_SYSTEM,
        prompt: planPrompt,
        accumulatedCostUsd: accumulatedCost,
        userSelectedModelId: input.userSelectedModelId,
        timeoutMs: PROVIDER_TIMEOUT_MS.build_plan,
      },
      input.buildTrace,
    );
    if (planCall.ok) {
      accumulatedCost += planCall.result.providerCostUsd;
      totalIn += planCall.result.inputTokens ?? 0;
      totalOut += planCall.result.outputTokens ?? 0;
      primaryModelId = planCall.result.spec.modelId;
      planJson = planCall.result.text;
      const parsedPlan = parseJsonFromModel<typeof planParsed>(planJson);
      if (parsedPlan) planParsed = { ...planParsed, ...parsedPlan };
    } else {
      deterministicPlanUsed = true;
      const det = buildDeterministicPlanForArchetype(archetype, executionPrompt);
      planParsed = det;
      planJson = deterministicPlanToJson(det);
      track(events, "planning", "Creating the app structure…");
      if (input.buildTrace) {
        traceBuildWorkerStage(input.buildTrace, "deterministic_plan_fallback_used", "planner_timeout");
      }
    }
  }

  if (!planJson) planJson = deterministicPlanToJson(planParsed);
  contextSlices = createBuildContextSlices(executionPrompt, scopeNote, input.operationId, planJson);
  const llmPlan = parseJsonFromModel<typeof planParsed>(planJson);
  if (llmPlan && !deterministicPlanUsed) planParsed = { ...planParsed, ...llmPlan };
  else if (llmPlan && knownArchetypeFastPath) planParsed = { ...planParsed, ...llmPlan };

  const complexity = Math.min(10, planParsed?.complexity ?? effectiveComplexity);

  const fallbackAppName = archetype.id === "restaurant_inventory" ? "Pantry Pro" : "Dream App";
  const identityFallback: AppIdentityResult = {
    appName: fallbackAppName,
    slug: slugifyAppName(fallbackAppName),
    shortDescription: planParsed?.summary ?? "",
    category: archetype.id === "restaurant_inventory" ? "restaurant" : "productivity",
    namingConfidence: 0.5,
    namingSource: "fallback",
    iconSvg: appIconSvgDataUrl(fallbackAppName),
    iconUrl: null,
    logoAssets: {},
    logoGenerationStatus: "skipped",
    logoGenerationError: null,
    logoGenerationActionCreditCost: 0,
    logoGenerationOperationId: input.operationId,
    reused: false,
  };

  if (input.buildTrace) traceBuildWorkerStage(input.buildTrace, "identity_started");
  let identityResult: AppIdentityResult;
  if (input.resumeContinuation) {
    const { data: resumeProj } = await input.writer
      .from("projects")
      .select("name")
      .eq("id", input.projectId)
      .maybeSingle();
    const resumedName = resumeProj?.name?.trim() || fallbackAppName;
    identityResult = {
      ...identityFallback,
      appName: resumedName,
      slug: slugifyAppName(resumedName),
      reused: true,
      logoGenerationStatus: "skipped",
      namingSource: "fallback",
    };
    track(events, "identity", "Resuming without renaming or new icon");
  } else {
    identityResult = await runBuildStage({
      stage: "generate_app_name",
      operationId: `${input.operationId}:identity`,
      modelUsed: primaryModelId,
      heartbeatMs: 2000,
      emit: (type, label, detail, meta) =>
        track(events, type as WorkflowEventType, label, detail, meta),
      emitAssistant: (msg) => trackAssistant(events, msg, emit),
      fn: async () => {
        const identityTimed = await withTimeout(
          createAppIdentityForBuild({
            writer: input.writer,
            userId: input.userId,
            userEmail: input.userEmail,
            projectId: input.projectId,
            buildOperationId: input.operationId,
            buildIntent: executionPrompt,
            planSummary: planParsed?.summary ?? planJson.slice(0, 800),
            categoryHint: planParsed?.entities?.[0] ? String(planParsed.entities[0]) : undefined,
            userSelectedModelId: input.userSelectedModelId,
            onProgress: (step) => track(events, "identity", step),
            skipLogo: false,
          }),
          PROVIDER_TIMEOUT_MS.app_identity ?? 45_000,
          "app_identity",
        );
        return identityTimed.ok ? identityTimed.value : identityFallback;
      },
    });
  }
  if (input.buildTrace) {
    traceBuildWorkerStage(
      input.buildTrace,
      identityResult.logoGenerationStatus === "failed" ? "identity_failed" : "identity_completed",
    );
  }

  const appName = identityResult.appName;
  const appSlug = identityResult.slug;
  const category = identityResult.category;
  let iconSvg = identityResult.iconSvg;
  if (!identityResult.iconUrl && !(iconSvg && iconSvg.startsWith("<svg"))) {
    iconSvg = appIconSvgDataUrl(appName, category);
  }
  if (identityResult.userNotice) track(events, "icon", identityResult.userNotice);
  const iconThinking = thinkingForIconStatus(
    identityResult.logoGenerationStatus,
    appName,
    identityResult.logoGenerationError,
    identityResult.iconGenerationMode,
  );
  if (iconThinking) trackAssistant(events, iconThinking, emit);

  track(events, "classified", `Archetype: ${archetype.label}`);
  trackAssistant(events, thinkingForArchetypeRoutes(archetype.id), emit);
  const designBrief: DesignBrief = buildDesignBrief({
    buildIntent: executionPrompt,
    archetype,
    appName,
    planSummary: planParsed?.summary,
    planPages: planParsed?.pages?.map(String),
  });
  track(events, "designing", "Creating design brief");

  const { data: projMetaRow } = await input.writer
    .from("projects")
    .select("metadata")
    .eq("id", input.projectId)
    .maybeSingle();
  const prevMeta =
    projMetaRow?.metadata && typeof projMetaRow.metadata === "object" && !Array.isArray(projMetaRow.metadata)
      ? (projMetaRow.metadata as Record<string, unknown>)
      : {};
  await input.writer
    .from("projects")
    .update({
      metadata: {
        ...prevMeta,
        app_archetype: archetype.id,
        app_type: archetypeToLegacyAppType(archetype.id),
        design_brief_routes: designBrief.routes,
        blueprint_routes: designBrief.routes,
        last_preview_session_id: null,
        preview_ready: false,
        preview_honest: false,
      } as Json,
    } as never)
    .eq("id", input.projectId)
    .eq("owner_id", input.userId);

  let schemaJson: string;
  let uiJson: string;

  if (knownArchetypeFastPath || deterministicPlanUsed) {
    schemaJson = JSON.stringify({ entities: planParsed?.entities ?? [] });
    uiJson = JSON.stringify({ routes: archetype.coreRoutes, pages: planParsed?.pages ?? [] });
    track(events, "designing", "Planning UI structure");
  } else {
    track(events, "schema", "Designing data schema");
    const schemaPromptText = schemaPrompt(planJson!, contextSlices);
    heavyBudget.record([schemaPromptText, BUILD_SYSTEM]);
    const schemaCall = await callProviderWithBuildTimeout(
      {
        writer: input.writer,
        userId: input.userId,
        userEmail: input.userEmail,
        operationId: `${input.operationId}:schema`,
        operationType: "schema_design",
        system: BUILD_SYSTEM,
        prompt: schemaPromptText,
        complexity,
        accumulatedCostUsd: accumulatedCost,
        timeoutMs: PROVIDER_TIMEOUT_MS.schema_design,
      },
      input.buildTrace,
    );
    if (schemaCall.ok) {
      accumulatedCost += schemaCall.result.providerCostUsd;
      schemaJson = schemaCall.result.text;
    } else {
      schemaJson = JSON.stringify({ entities: planParsed?.entities ?? [] });
    }
    contextSlices = createBuildContextSlices(
      executionPrompt,
      scopeNote,
      input.operationId,
      planJson!,
      schemaJson,
    );

    track(events, "designing", "Planning UI structure");
    const uiPromptText = uiPlanPrompt(planJson!, schemaJson, executionPrompt, contextSlices, designBrief);
    heavyBudget.record([uiPromptText, BUILD_SYSTEM]);
    const uiCall = await callProviderWithBuildTimeout(
      {
        writer: input.writer,
        userId: input.userId,
        userEmail: input.userEmail,
        operationId: `${input.operationId}:ui`,
        operationType: "ui_design_plan",
        system: BUILD_SYSTEM,
        prompt: uiPromptText,
        complexity,
        accumulatedCostUsd: accumulatedCost,
        userSelectedModelId: input.userSelectedModelId,
        timeoutMs: PROVIDER_TIMEOUT_MS.ui_design_plan,
      },
      input.buildTrace,
    );
    if (uiCall.ok) {
      accumulatedCost += uiCall.result.providerCostUsd;
      uiJson = uiCall.result.text;
    } else {
      uiJson = JSON.stringify({ routes: archetype.coreRoutes });
    }
  }
  contextSlices = createBuildContextSlices(
    executionPrompt,
    scopeNote,
    input.operationId,
    planJson,
    schemaJson,
    uiJson,
  );

  track(events, "writing", "Generating screens and components");

  if (accumulatedCost >= FULL_BUILD_CAP_USD * 0.85) {
    return {
      ok: false,
      visibleText: "This build is too large for one pass. I staged the core plan — continue with a follow-up prompt for the next features.",
      meta: null,
      iconSvg: iconSvg || null,
      iconUrl: identityResult.iconUrl,
      appName,
      files: [],
      events,
      totalProviderCostUsd: accumulatedCost,
      totalInputTokens: totalIn,
      totalOutputTokens: totalOut,
      primaryModelId,
      complexity,
      uiQualityScore: 0,
      dashboardQualityScore: 0,
      uiRichnessPasses: false,
      buildContract: {
        passed: false,
        allowed: false,
        failures: ["build_budget_precheck"],
        renderableCount: 0,
        pageCount: 0,
        uiQualityScore: 0,
        previewReady: false,
        userMessage: "This build is too large for one pass — try a smaller scope or continue in a follow-up prompt.",
      },
      errorMessage: "build_budget_precheck",
      appArchetype: archetype.id,
      postBuildFailures: ["build_budget_precheck"],
    };
  }

  trackAssistant(events, thinkingForFrontendStart(appName), emit);
  track(events, "writing", "Generating frontend files");
  if (input.buildTrace) traceBuildWorkerStage(input.buildTrace, "file_generation_started");

  const smokeBuild = isSmokeBuildMode();
  const scaffoldOpts = { allowFullScaffold: smokeBuild };
  const MIN_FULL_SCAFFOLD_FILES = 14;
  let allFiles: BuildFile[] = input.resumeContinuation
    ? await loadPersistedBuildFiles(input.writer, input.projectId)
    : [];

  /** Smoke builds may skip the model; production always runs frontend_implementation for premium UI. */
  const scaffoldSufficient =
    smokeBuild &&
    hasFullScaffoldTree(archetype.id) &&
    filterRenderableBuildFiles(allFiles).length >= MIN_FULL_SCAFFOLD_FILES &&
    rootPageContentOk(allFiles);

  const userPickedPremiumModel =
    Boolean(input.userSelectedModelId) && !isAutomaticModelId(input.userSelectedModelId);
  const frontendComplexity = smokeBuild ? 3 : userPickedPremiumModel ? Math.max(complexity, 7) : complexity;

  if (!scaffoldSufficient) {
    setBuildPhase("model_generating", "writing", "Generating source files");
    const ingestChunk = async (text: string, files: BuildFile[]) =>
      ingestModelFilesWithExtractionStream(
        text,
        files,
        events,
        track,
        effectiveMaxFiles,
        onFileStreamStart,
        onFileStreamDelta,
        onFileStreamComplete,
        onExtractStart,
      );

    if (smokeBuild) {
      const fePrompt = minimalFrontendPrompt(executionPrompt, planJson!, contextSlices, designBrief);
      heavyBudget.record([fePrompt, BUILD_SYSTEM]);
      heavyBudget.assertWithinBudget(true);
      continuationAttemptsTotal += 1;
      const feCall = await modelHeartbeat(
        {
          writer: input.writer,
          userId: input.userId,
          userEmail: input.userEmail,
          operationId: `${input.operationId}:frontend`,
          operationType: "frontend_implementation",
          system: BUILD_SYSTEM,
          prompt: fePrompt,
          complexity: frontendComplexity,
          accumulatedCostUsd: accumulatedCost,
          userSelectedModelId: input.userSelectedModelId,
          timeoutMs: CHUNK_MODEL_TIMEOUT_MS,
        },
        "app shell and core routes",
        continuationAttemptsTotal,
      );
      if (feCall.ok) {
        accumulatedCost += feCall.result.providerCostUsd;
        totalIn += feCall.result.inputTokens ?? 0;
        totalOut += feCall.result.outputTokens ?? 0;
        primaryModelId = feCall.result.spec.modelId;
        allFiles = await ingestChunk(feCall.result.text, allFiles);
      }
    } else if (input.routeByRouteOnly || input.resumeContinuation) {
      trackAssistant(events, timeoutUserMessage("route_by_route"), emit);
      const contState = await loadContinuationMeta(input.writer, input.projectId);
      const rbr = await runRouteByRouteGeneration({
        writer: input.writer,
        userId: input.userId,
        userEmail: input.userEmail,
        operationId: input.operationId,
        system: BUILD_SYSTEM,
        complexity: frontendComplexity,
        accumulatedCostUsd: accumulatedCost,
        userSelectedModelId: input.userSelectedModelId,
        buildTrace: input.buildTrace,
        executionPrompt,
        planJson: planJson!,
        designBrief,
        appName,
        routes: designBrief.routes ?? archetype.coreRoutes,
        initialFiles: allFiles,
        startIndex: contState?.stageIndex ?? 0,
        ingestChunk,
        onChunkStart: (_i, _t, chunk) => trackAssistant(events, chunk.activeWork, emit),
        onChunkActiveWork: (line, meta) => {
          emitBuildHeartbeat(events as Parameters<typeof emitBuildHeartbeat>[0], line, emit as never, {
            active_work: true,
            ...meta,
          });
        },
        onChunkComplete: () => undefined,
        onStrategyChange: (line) => trackAssistant(events, line, emit),
        onPaused: (line) => trackAssistant(events, line, emit),
      });
      accumulatedCost += rbr.costUsd;
      allFiles = rbr.files;
      primaryModelId = rbr.modelId;
    } else {
      trackAssistant(
        events,
        buildDomainOpenerFromPrompt(input.userPrompt),
        emit,
      );
      const chunked = await runChunkedFrontendGeneration({
        writer: input.writer,
        userId: input.userId,
        userEmail: input.userEmail,
        operationId: input.operationId,
        system: BUILD_SYSTEM,
        complexity: frontendComplexity,
        accumulatedCostUsd: accumulatedCost,
        userSelectedModelId: input.userSelectedModelId,
        buildTrace: input.buildTrace,
        executionPrompt,
        planJson: planJson!,
        designBrief,
        appName,
        routes: designBrief.routes ?? archetype.coreRoutes,
        initialFiles: allFiles,
        maxFiles: effectiveMaxFiles,
        ingestChunk,
        onChunkStart: (index, total, chunk, progressLine) => {
          setBuildPhase("model_generating", "writing", `Generation plan: ${progressLine}`, undefined, {
            generation_chunk_id: chunk.id,
            generation_chunk_index: index,
            generation_chunk_total: total,
            generation_chunk_label: chunk.label,
            chunk_progress_line: progressLine,
          });
          trackAssistant(events, chunk.activeWork, emit);
        },
        onChunkActiveWork: (line, meta) => {
          emitBuildHeartbeat(events as Parameters<typeof emitBuildHeartbeat>[0], line, emit as never, {
            build_terminal_phase: currentBuildPhase,
            active_work: true,
            ...meta,
          });
        },
        onChunkComplete: (index, total, chunk, fileCount) => {
          track(
            events,
            "writing",
            fileCount > 0 ? `${index}/${total} ${chunk.label} — ${fileCount} file${fileCount === 1 ? "" : "s"}` : `${index}/${total} ${chunk.label} complete`,
            undefined,
            {
              chunk_complete: true,
              generation_chunk_id: chunk.id,
              generation_chunk_index: index,
              generation_chunk_total: total,
              files_from_chunk: fileCount,
            },
          );
        },
        onChunkSkipped: (chunk, reason) => {
          if (reason === "chunk_timeout") {
            trackAssistant(events, timeoutUserMessage("smaller_chunk"), emit);
          }
        },
      });
      accumulatedCost += chunked.costUsd;
      totalIn += chunked.inputTokens;
      totalOut += chunked.outputTokens;
      primaryModelId = chunked.modelId;
      allFiles = chunked.files;
      continuationAttemptsTotal += chunked.chunksRun;

      const renderableAfterChunked = filterRenderableBuildFiles(allFiles).length;
      if (
        !input.routeByRouteOnly &&
        renderableAfterChunked < generationBudget.minFiles * 0.5
      ) {
        trackAssistant(events, timeoutUserMessage("route_by_route"), emit);
        const rbr = await runRouteByRouteGeneration({
          writer: input.writer,
          userId: input.userId,
          userEmail: input.userEmail,
          operationId: input.operationId,
          system: BUILD_SYSTEM,
          complexity: frontendComplexity,
          accumulatedCostUsd: accumulatedCost,
          userSelectedModelId: input.userSelectedModelId,
          buildTrace: input.buildTrace,
          executionPrompt,
          planJson: planJson!,
          designBrief,
          appName,
          routes: designBrief.routes ?? archetype.coreRoutes,
          initialFiles: allFiles,
          ingestChunk,
          onChunkStart: (index, total, chunk, progressLine) => {
            setBuildPhase("model_generating", "writing", `Route plan: ${progressLine}`);
            trackAssistant(events, chunk.activeWork, emit);
          },
          onChunkActiveWork: (line, meta) => {
            emitBuildHeartbeat(events as Parameters<typeof emitBuildHeartbeat>[0], line, emit as never, {
              build_terminal_phase: currentBuildPhase,
              active_work: true,
              ...meta,
            });
          },
          onChunkComplete: (index, total, chunk, fileCount) => {
            track(events, "writing", `${index}/${total} ${chunk.label} — ${fileCount} files`);
          },
          onStrategyChange: (line) => trackAssistant(events, line, emit),
          onPaused: (line) => trackAssistant(events, line, emit),
        });
        accumulatedCost += rbr.costUsd;
        totalIn += rbr.inputTokens;
        totalOut += rbr.outputTokens;
        primaryModelId = rbr.modelId;
        allFiles = rbr.files;
        if (rbr.paused) {
          await input.writer
            .from("projects")
            .update({
              metadata: {
                ...(await loadProjectMeta(input.writer, input.projectId)),
                ...writeBuildContinuationStatePatch({
                  parentBuildJobId: input.buildJobId,
                  routeByRoute: true,
                  stageIndex: rbr.chunksCompleted,
                  routesRemaining: designBrief.routes ?? [],
                  pausedAt: new Date().toISOString(),
                  reason: "timeout_pause",
                }),
              } as never,
            } as never)
            .eq("id", input.projectId);
        }
      }
    }
  } else if (input.buildTrace) {
    traceBuildWorkerStage(
      input.buildTrace,
      "scaffold_fallback_applied",
      String(filterRenderableBuildFiles(allFiles).length),
    );
  }

  if (!hasRouteFiles(allFiles) && accumulatedCost < FULL_BUILD_CAP_USD * 0.92) {
    setBuildPhase("continuation_running", "writing", "Retrying with compact route set", undefined, {
      continuation_attempt: continuationAttemptsTotal + 1,
      continuation_max: MAX_SAFE_CONTINUATION_ATTEMPTS,
    });
    continuationAttemptsTotal += 1;
    trackAssistant(events, "Core layout is ready. I'm adding primary route pages next.", emit);
    const compactRoutes = uniquePlannedFilePaths(designBrief.routes ?? archetype.coreRoutes, 6);
    const routeRetryPrompt = smokeBuild
      ? minimalFrontendPrompt(executionPrompt, planJson, contextSlices, designBrief)
      : compactRouteRetryPrompt(executionPrompt, planJson!, compactRoutes, designBrief);
    track(events, "writing", "Requesting core pages from model");
    const miniCall = await modelHeartbeat(
      {
        writer: input.writer,
        userId: input.userId,
        userEmail: input.userEmail,
        operationId: `${input.operationId}:frontend-mini`,
        operationType: "frontend_implementation",
        system: BUILD_SYSTEM,
        prompt: routeRetryPrompt,
        complexity: Math.max(frontendComplexity, 5),
        accumulatedCostUsd: accumulatedCost,
        userSelectedModelId: input.userSelectedModelId,
        timeoutMs: CHUNK_MODEL_TIMEOUT_MS,
      },
      "core pages from compact route set",
      continuationAttemptsTotal,
    );
    if (!miniCall.ok) {
      trackAssistant(
        events,
        timeoutUserMessage(miniCall.timedOut ? "smaller_chunk" : "route_by_route"),
        emit,
      );
    } else {
    accumulatedCost += miniCall.result.providerCostUsd;
    allFiles = await ingestModelFilesWithExtractionStream(
      miniCall.result.text,
      allFiles,
      events,
      track,
      effectiveMaxFiles,
      onFileStreamStart,
      onFileStreamDelta,
      onFileStreamComplete,
      onExtractStart,
    );
    }
    clearStalePlannedPlaceholders(allFiles);
    if (!miniCall.ok || allFiles.length === 0) {
      trackAssistant(events, userContinuationProgressLine(1), emit);
    }
  }

  allFiles = filterRenderableBuildFiles(allFiles);
  clearStalePlannedPlaceholders(allFiles);

  const modelFilesBeforeScaffold = allFiles.length;
  let generationQualityReport = scoreGeneratedAppQuality({
    files: allFiles,
    budget: generationBudget,
    userPrompt: executionPrompt,
    appType: archetypeToLegacyAppType(archetype.id),
    routeMap: designBrief.routes,
  });

  let meaningfulQualityReport = scoreMeaningfulUiQuality({
    files: allFiles,
    budget: generationBudget,
    userPrompt: executionPrompt,
    routeMap: designBrief.routes,
  });

  let continuationPass = 0;
  let continuationTimeouts = 0;
  while (
    accumulatedCost < FULL_BUILD_CAP_USD * 0.92 &&
    continuationPass < MAX_USER_CONTINUATION_PASSES &&
    continuationAttemptsTotal < MAX_USER_CONTINUATION_PASSES + 1
  ) {
    const genericCheck = detectGenericScaffoldBuild(allFiles);
    const continuationDecision = shouldContinueGeneration({
      report: generationQualityReport,
      budget: generationBudget,
      passIndex: continuationPass,
      maxPasses: generationBudget.maxContinuationPasses + 2,
      budgetRemainingRatio: 1 - accumulatedCost / FULL_BUILD_CAP_USD,
      genericScaffold: genericCheck.isGeneric,
      meaningfulQualityPasses: meaningfulQualityReport.passes,
    });
    if (!continuationDecision.shouldContinue && meaningfulQualityReport.passes && !generationQualityReport.needsContinuation) {
      break;
    }
    if (
      !continuationDecision.shouldContinue &&
      (continuationDecision.reason === "budget_exhausted" ||
        continuationDecision.reason === "max_passes" ||
        continuationPass >= generationBudget.maxContinuationPasses + 2)
    ) {
      break;
    }

    continuationAttemptsTotal += 1;
    setBuildPhase("continuation_running", "writing", "Continuing app generation", undefined, {
      continuation_attempt: continuationAttemptsTotal,
      continuation_max: MAX_SAFE_CONTINUATION_ATTEMPTS,
    });
    trackAssistant(
      events,
      userContinuationProgressLine(continuationAttemptsTotal),
      emit,
    );
    const contPrompt = buildContinuationFrontendPrompt({
      executionBrief: executionPrompt,
      planJson,
      existingFiles: allFiles,
      budget: generationBudget,
      report: generationQualityReport,
      passIndex: continuationPass,
      weakFilePaths: meaningfulQualityReport.weak_file_paths,
    });
    heavyBudget.record([contPrompt, BUILD_SYSTEM]);
    const contCall = await modelHeartbeat(
      {
        writer: input.writer,
        userId: input.userId,
        userEmail: input.userEmail,
        operationId: `${input.operationId}:frontend-cont-${continuationPass}`,
        operationType: "frontend_implementation",
        system: BUILD_SYSTEM,
        prompt: contPrompt,
        complexity,
        accumulatedCostUsd: accumulatedCost,
        userSelectedModelId: input.userSelectedModelId,
        timeoutMs: CHUNK_MODEL_TIMEOUT_MS,
      },
      "full continuation pass",
      continuationAttemptsTotal,
    );
    if (!contCall.ok) {
      continuationTimeouts += 1;
      if (continuationTimeouts >= MAX_USER_CONTINUATION_PASSES) {
        trackAssistant(events, timeoutUserMessage("route_by_route"), emit);
        const rbr = await runRouteByRouteGeneration({
          writer: input.writer,
          userId: input.userId,
          userEmail: input.userEmail,
          operationId: `${input.operationId}:cont-rbr`,
          system: BUILD_SYSTEM,
          complexity: frontendComplexity,
          accumulatedCostUsd: accumulatedCost,
          userSelectedModelId: input.userSelectedModelId,
          buildTrace: input.buildTrace,
          executionPrompt,
          planJson,
          designBrief,
          appName,
          routes: designBrief.routes ?? archetype.coreRoutes,
          initialFiles: allFiles,
          ingestChunk: async (text, files) =>
            ingestModelFilesWithExtractionStream(
              text,
              files,
              events,
              track,
              effectiveMaxFiles,
              onFileStreamStart,
              onFileStreamDelta,
              onFileStreamComplete,
              onExtractStart,
            ),
          onChunkStart: (_i, _t, chunk) => trackAssistant(events, chunk.activeWork, emit),
          onChunkActiveWork: (line, meta) => {
            emitBuildHeartbeat(events as Parameters<typeof emitBuildHeartbeat>[0], line, emit as never, {
              active_work: true,
              ...meta,
            });
          },
          onChunkComplete: () => undefined,
          onStrategyChange: (line) => trackAssistant(events, line, emit),
          onPaused: (line) => trackAssistant(events, line, emit),
        });
        accumulatedCost += rbr.costUsd;
        allFiles = rbr.files;
        break;
      }
      trackAssistant(events, timeoutUserMessage("smaller_chunk"), emit);
      continuationPass += 1;
      continue;
    }
    accumulatedCost += contCall.result.providerCostUsd;
    totalIn += contCall.result.inputTokens ?? 0;
    totalOut += contCall.result.outputTokens ?? 0;
    primaryModelId = contCall.result.spec.modelId;
    traceCollector?.noteModelCall({
      startedAt: new Date(Date.now() - 30_000).toISOString(),
      completedAt: new Date().toISOString(),
      responseChars: contCall.result.text.length,
      maxOutputTokens: contCall.result.spec.maxOutputTokens,
      modelId: contCall.result.spec.modelId,
      provider: contCall.result.spec.provider ?? null,
    });
    const beforeCont = allFiles.length;
    allFiles = filterRenderableBuildFiles(
      await ingestModelFilesWithExtractionStream(
        contCall.result.text,
        allFiles,
        events,
        track,
        effectiveMaxFiles,
        onFileStreamStart,
        onFileStreamDelta,
        onFileStreamComplete,
        onExtractStart,
      ),
    );
    continuationPass += 1;
    const genericMid = detectGenericScaffoldBuild(allFiles);
    if (
      !genericMid.isGeneric &&
      allFiles.length <= beforeCont &&
      meaningfulQualityReport.passes &&
      !generationQualityReport.needsContinuation
    ) {
      break;
    }
    generationQualityReport = scoreGeneratedAppQuality({
      files: allFiles,
      budget: generationBudget,
      userPrompt: executionPrompt,
      appType: archetypeToLegacyAppType(archetype.id),
      routeMap: designBrief.routes,
    });
    meaningfulQualityReport = scoreMeaningfulUiQuality({
      files: allFiles,
      budget: generationBudget,
      userPrompt: executionPrompt,
      routeMap: designBrief.routes,
    });
    traceCollector?.noteContinuation({
      reason: continuationDecision.reason,
      fileCount: allFiles.length,
      qualityScore: meaningfulQualityReport.final_quality_score,
      meaningfulRoutes: meaningfulQualityReport.meaningful_routes,
      weakFiles: meaningfulQualityReport.weak_file_paths,
    });
    const genericAfter = detectGenericScaffoldBuild(allFiles);
    if (
      meaningfulQualityReport.passes &&
      !generationQualityReport.needsContinuation &&
      !genericAfter.isGeneric
    ) {
      break;
    }
  }

  // Targeted rewrite when routes/quality still thin after continuation passes.
  let targetedRewritePass = 0;
  while (
    targetedRewritePass < 2 &&
    continuationAttemptsTotal < MAX_SAFE_CONTINUATION_ATTEMPTS &&
    accumulatedCost < FULL_BUILD_CAP_USD * 0.92 &&
    (generationQualityReport.needsContinuation ||
      !meaningfulQualityReport.passes ||
      meaningfulQualityReport.meaningful_routes < generationBudget.minRoutes)
  ) {
    continuationAttemptsTotal += 1;
    targetedRewritePass += 1;
    setBuildPhase("continuation_running", "writing", "Targeted rewrite pass", undefined, {
      continuation_attempt: continuationAttemptsTotal,
      continuation_max: MAX_SAFE_CONTINUATION_ATTEMPTS,
    });
    trackAssistant(events, "Strengthening thin pages and filling missing routes…", emit);
    const rewritePrompt = buildContinuationFrontendPrompt({
      executionBrief: executionPrompt,
      planJson,
      existingFiles: allFiles,
      budget: generationBudget,
      report: generationQualityReport,
      passIndex: continuationPass + targetedRewritePass,
      weakFilePaths: meaningfulQualityReport.weak_file_paths,
    });
    const rewriteCall = await modelHeartbeat(
      {
        writer: input.writer,
        userId: input.userId,
        userEmail: input.userEmail,
        operationId: `${input.operationId}:targeted-rewrite-${targetedRewritePass}`,
        operationType: "frontend_implementation",
        system: BUILD_SYSTEM,
        prompt: rewritePrompt,
        complexity: Math.max(frontendComplexity, 7),
        accumulatedCostUsd: accumulatedCost,
        userSelectedModelId: input.userSelectedModelId,
        timeoutMs: CHUNK_MODEL_TIMEOUT_MS,
      },
      "targeted page rewrite",
      continuationAttemptsTotal,
    );
    if (!rewriteCall.ok) {
      trackAssistant(events, "Targeted rewrite did not return output — moving to quality repair…", emit);
      break;
    }
    accumulatedCost += rewriteCall.result.providerCostUsd;
    primaryModelId = rewriteCall.result.spec.modelId;
    setBuildPhase("extracting_files", "writing", "Parsing rewritten files");
    allFiles = filterRenderableBuildFiles(
      await ingestModelFilesWithExtractionStream(
        rewriteCall.result.text,
        allFiles,
        events,
        track,
        effectiveMaxFiles,
        onFileStreamStart,
        onFileStreamDelta,
        onFileStreamComplete,
        onExtractStart,
      ),
    );
    generationQualityReport = scoreGeneratedAppQuality({
      files: allFiles,
      budget: generationBudget,
      userPrompt: executionPrompt,
      appType: archetypeToLegacyAppType(archetype.id),
      routeMap: designBrief.routes,
    });
    meaningfulQualityReport = scoreMeaningfulUiQuality({
      files: allFiles,
      budget: generationBudget,
      userPrompt: executionPrompt,
      routeMap: designBrief.routes,
    });
    if (meaningfulQualityReport.passes && !generationQualityReport.needsContinuation) break;
  }

  let antiScaffoldPass = 0;
  while (
    isProductionBuildMode() &&
    detectGenericScaffoldBuild(allFiles).isGeneric &&
    antiScaffoldPass < 2 &&
    continuationPass < generationBudget.maxContinuationPasses + 2 &&
    accumulatedCost < FULL_BUILD_CAP_USD * 0.92
  ) {
    const antiPrompt = buildAntiScaffoldContinuationPrompt({
      executionBrief: executionPrompt,
      planJson,
      existingFiles: allFiles,
      budget: generationBudget,
      weakFilePaths: meaningfulQualityReport.weak_file_paths,
      qualityScore: meaningfulQualityReport.final_quality_score,
      qualityTarget: meaningfulQualityReport.min_required_score,
      passIndex: antiScaffoldPass,
    });
    trackAssistant(
      events,
      "Model generation did not produce a complete app. I'm retrying with a stricter full-app prompt.",
      emit,
    );
    track(events, "writing", "Retrying full-app generation");
    const antiCall = await callProviderWithBuildTimeout(
      {
        writer: input.writer,
        userId: input.userId,
        userEmail: input.userEmail,
        operationId: `${input.operationId}:anti-scaffold-${antiScaffoldPass}`,
        operationType: "frontend_implementation",
        system: BUILD_SYSTEM,
        prompt: antiPrompt,
        complexity: Math.max(frontendComplexity, 8),
        accumulatedCostUsd: accumulatedCost,
        userSelectedModelId: input.userSelectedModelId,
        timeoutMs: CHUNK_MODEL_TIMEOUT_MS,
      },
      input.buildTrace,
    );
    if (!antiCall.ok) {
      trackAssistant(
        events,
        "Continuation failed to improve the app — stopping before preview.",
        emit,
      );
      break;
    }
    accumulatedCost += antiCall.result.providerCostUsd;
    primaryModelId = antiCall.result.spec.modelId;
    const beforeAnti = allFiles.length;
    allFiles = filterRenderableBuildFiles(
      await ingestModelFilesWithExtractionStream(
        antiCall.result.text,
        allFiles,
        events,
        track,
        effectiveMaxFiles,
        onFileStreamStart,
        onFileStreamDelta,
        onFileStreamComplete,
        onExtractStart,
      ),
    );
    generationQualityReport = scoreGeneratedAppQuality({
      files: allFiles,
      budget: generationBudget,
      userPrompt: executionPrompt,
      appType: archetypeToLegacyAppType(archetype.id),
      routeMap: designBrief.routes,
    });
    meaningfulQualityReport = scoreMeaningfulUiQuality({
      files: allFiles,
      budget: generationBudget,
      userPrompt: executionPrompt,
      routeMap: designBrief.routes,
    });
    antiScaffoldPass += 1;
    continuationPass += 1;
    traceCollector?.noteContinuation({
      reason: "anti_scaffold_retry",
      fileCount: allFiles.length,
      qualityScore: meaningfulQualityReport.final_quality_score,
      meaningfulRoutes: meaningfulQualityReport.meaningful_routes,
      weakFiles: meaningfulQualityReport.weak_file_paths,
    });
    if (
      !detectGenericScaffoldBuild(allFiles).isGeneric &&
      (allFiles.length > beforeAnti || meaningfulQualityReport.passes)
    ) {
      break;
    }
    if (antiScaffoldPass >= 2) {
      trackAssistant(
        events,
        "Continuation failed to improve the app — stopping before preview.",
        emit,
      );
    }
  }

  if (generationQualityReport.score > 0 || meaningfulQualityReport.final_quality_score > 0) {
    setBuildPhase(
      "validating_quality",
      "validating",
      "Checking screens and navigation coverage…",
      undefined,
      { streamCategory: "quality_check", diagnostics_only: true },
    );
  }

  if (isPortfolioBuildPrompt(input.userPrompt)) {
    const preIntegrity = evaluateSourceIntegrity(allFiles);
    if (!preIntegrity.sourceIntegrityOk) {
      allFiles = filterRenderableBuildFiles(mergePortfolioScaffold(allFiles, appName));
      if (input.buildTrace) {
        traceBuildWorkerStage(input.buildTrace, "scaffold_fallback_applied", `portfolio:${allFiles.length}`);
      }
    }
  }

  if (input.shouldStopForCredits?.() && allFiles.length > 0) {
    track(
      events,
      "saving",
      "Saving progress",
      `partial_credit_stop:${allFiles.length}_files`,
    );
    return {
      ok: false,
      partialCreditStop: true,
      visibleText:
        "I used your remaining Build Credits and saved the progress. Add credits to continue the remaining steps.",
      meta: null,
      iconSvg: iconSvg || null,
      iconUrl: identityResult.iconUrl,
      appName,
      files: allFiles,
      events,
      totalProviderCostUsd: accumulatedCost,
      totalInputTokens: totalIn,
      totalOutputTokens: totalOut,
      primaryModelId,
      complexity,
      uiQualityScore: 0,
      dashboardQualityScore: 0,
      uiRichnessPasses: false,
      buildContract: {
        passed: false,
        allowed: true,
        failures: ["partial_credit_stop"],
        renderableCount: allFiles.length,
        pageCount: countRenderablePages(allFiles),
        uiQualityScore: 0,
        previewReady: false,
        userMessage:
          "I used your remaining Build Credits and saved the progress. Add credits to continue the remaining steps.",
      },
      errorMessage: "partial_credit_stop",
      appArchetype: archetype.id,
      postBuildFailures: ["partial_credit_stop"],
    };
  }

  const blueprintRoutes = planParsed?.pages?.map((p) => String(p)) ?? archetype.coreRoutes;
  const routeNorm = normalizeAppRouterBuildFiles(allFiles, {
    blueprintRoutes,
    appName,
  });
  allFiles = routeNorm.files;
  if (routeNorm.moved.length && process.env.NODE_ENV !== "production") {
    console.info("[build] app_router_normalized", routeNorm.moved.slice(0, 12));
  }

  const rootRepairPass = repairRootPageContent(archetype.id, allFiles, appName);
  if (rootRepairPass.rootPageRepaired || rootRepairPass.deterministicRepairApplied) {
    allFiles = rootRepairPass.files;
    if (input.buildTrace) {
      traceBuildWorkerStage(input.buildTrace, "scaffold_fallback_applied", `root_page:${rootRepairPass.integrityAfterRepair.rootPageHasRealContent}`);
    }
  }

  let scaffoldFallback = applyArchetypeScaffoldFallback(
    archetype.id,
    allFiles,
    appName,
    scaffoldOpts,
  );
  if (scaffoldFallback.usedFallback) {
    const genericCandidate = detectGenericScaffoldBuild(scaffoldFallback.files);
    const blockGeneric = isProductionBuildMode() && genericCandidate.isGeneric;
    if (blockGeneric) {
      trackAssistant(
        events,
        "Blocked generic scaffold template — continuing with full model generation instead.",
        emit,
      );
    } else {
      trackAssistant(
        events,
        scaffoldFallback.beforeCount > 0
          ? thinkingForFrontendFailed()
          : "Model didn't return files — applying a minimal starter structure.",
        emit,
      );
      track(events, "validating", "Strengthening the app structure…");
      allFiles = scaffoldFallback.files;
    }
    if (process.env.NODE_ENV !== "production") {
      console.info("[build] scaffold_fallback_used", {
        archetype: archetype.id,
        reason: scaffoldFallback.reason,
        before: scaffoldFallback.beforeCount,
        after: scaffoldFallback.afterCount,
        blocked_generic: blockGeneric,
      });
    }
  }

  const postScaffoldNorm = normalizeAppRouterBuildFiles(allFiles, {
    blueprintRoutes,
    appName,
  });
  allFiles = postScaffoldNorm.files;

  const allowBackend =
    (firstPassScope?.includeBackend ?? complexity >= 7) &&
    hasRouteFiles(allFiles) &&
    accumulatedCost < FULL_BUILD_CAP_USD * 0.9;

  if (allowBackend) {
    track(events, "writing", "Generating backend files");
    try {
      const beCall = await callProviderWithBuildTimeout(
        {
          writer: input.writer,
          userId: input.userId,
          userEmail: input.userEmail,
          operationId: `${input.operationId}:backend`,
          operationType: "backend_implementation",
          system: BUILD_SYSTEM,
          prompt: backendPrompt(planJson, schemaJson, contextSlices),
          complexity,
          accumulatedCostUsd: accumulatedCost,
          userSelectedModelId: input.userSelectedModelId,
          timeoutMs: PROVIDER_TIMEOUT_MS.backend_implementation,
        },
        input.buildTrace,
      );
      if (beCall.ok) {
      accumulatedCost += beCall.result.providerCostUsd;
      const bePayload = parseFilePayload(beCall.result.text);
      if (bePayload.files.length) {
        allFiles = mergeIncomingBuildFiles(
          allFiles,
          bePayload.files,
          events,
          track,
          effectiveMaxFiles,
          onFileStreamStart,
        );
      }
      }
    } catch {
      /* backend optional */
    }
  }

  trackAssistant(
    events,
    `Checking imports, routes, and preview readiness across ${allFiles.length} file${allFiles.length === 1 ? "" : "s"}.`,
    emit,
  );
  track(events, "validating", `Validating ${allFiles.length} files`);
  let quality = assessBuildQuality(allFiles);
  let repairAttempts = 0;

  let uiQuality = checkGeneratedUiQuality({
    files: allFiles,
    appType: archetypeToLegacyAppType(archetype.id),
    routeMap: designBrief.routes,
  });

  const deterministicScaffoldReady =
    scaffoldSufficient &&
    evaluateSourceIntegrity(allFiles).sourceIntegrityOk &&
    filterRenderableBuildFiles(allFiles).length >= MIN_FULL_SCAFFOLD_FILES;

  while (
    !deterministicScaffoldReady &&
    (!quality.ok || !uiQuality.passesPreview) &&
    repairAttempts < 3 &&
    accumulatedCost < FULL_BUILD_CAP_USD
  ) {
    track(events, "repairing", userFacingRepairPassLabel(repairAttempts));
    const repairPrompt = uiQuality.basicUiFailure || uiQuality.score < previewReadyMinScore()
      ? buildPremiumUiRepairPrompt({
          designBrief,
          quality: uiQuality,
          files: allFiles,
          userPrompt: executionPrompt,
        })
      : buildRepairPrompt(quality.reasons, allFiles, executionPrompt);
    const repairCall = await callProviderWithBuildTimeout(
      {
        writer: input.writer,
        userId: input.userId,
        userEmail: input.userEmail,
        operationId: `${input.operationId}:ui-repair:${repairAttempts}`,
        operationType: repairAttempts === 0 ? "code_repair_small" : "code_repair_hard",
        system: BUILD_SYSTEM,
        prompt: repairPrompt,
        complexity,
        accumulatedCostUsd: accumulatedCost,
        userSelectedModelId: input.userSelectedModelId,
        timeoutMs:
          repairAttempts === 0
            ? PROVIDER_TIMEOUT_MS.code_repair_small
            : PROVIDER_TIMEOUT_MS.code_repair_hard,
      },
      input.buildTrace,
    );
    if (!repairCall.ok) {
      const budgetBlocked = repairCall.error.includes("Budget exceeded");
      if (budgetBlocked || !rootPageContentOk(allFiles)) {
        const deterministic = repairRootPageContent(archetype.id, allFiles, appName, {
          repairModelAttempted: true,
          repairBudgetBlocked: budgetBlocked,
        });
        allFiles = deterministic.files;
        if (deterministic.rootPageRepaired) {
          track(events, "repairing", "Regenerating the main screen…");
        }
        quality = assessBuildQuality(allFiles);
        uiQuality = checkGeneratedUiQuality({
          files: allFiles,
          appType: archetypeToLegacyAppType(archetype.id),
          routeMap: designBrief.routes,
        });
      }
      break;
    }
    accumulatedCost += repairCall.result.providerCostUsd;
    const repaired = parseFilePayload(repairCall.result.text);
    if (repaired.files.length) {
      allFiles = filterRenderableBuildFiles(
        mergeIncomingBuildFiles(allFiles, repaired.files, events, track, effectiveMaxFiles, onFileStreamStart),
      );
    }
    quality = assessBuildQuality(allFiles);
    uiQuality = checkGeneratedUiQuality({
      files: allFiles,
      appType: archetypeToLegacyAppType(archetype.id),
      routeMap: designBrief.routes,
    });
    repairAttempts += 1;
  }

  track(events, "validating", "Checking the interface…");

  scaffoldFallback = applyArchetypeScaffoldFallback(
    archetype.id,
    allFiles,
    appName,
    scaffoldOpts,
  );
  if (scaffoldFallback.usedFallback && !isModelOutputSufficient(allFiles)) {
    const genericRepair = detectGenericScaffoldBuild(scaffoldFallback.files);
    if (!isProductionBuildMode() || !genericRepair.isGeneric) {
      trackAssistant(events, thinkingForQualityCheck(), emit);
      allFiles = scaffoldFallback.files;
    }
  }

  const fileQuality = validateGeneratedBuild(allFiles);

  const { data: projAfterIdentity } = await input.writer
    .from("projects")
    .select("app_name, icon_url, icon_svg")
    .eq("id", input.projectId)
    .maybeSingle();

  const resolvedAppName = projAfterIdentity?.app_name?.trim() || appName;
  const hasIcon = Boolean(
    identityResult.iconUrl ||
      projAfterIdentity?.icon_url ||
      (iconSvg && iconSvg.startsWith("<svg")) ||
      projAfterIdentity?.icon_svg ||
      scaffoldFallback.usedFallback,
  );

  const requiredSlugs = requiredPageSlugsForArchetype(archetype.id);
  const tier: "small" | "standard" | "advanced" =
    complexity <= 2 ? "small" : complexity >= 7 ? "advanced" : "standard";

  if (
    smokeBuild &&
    hasFullScaffoldTree(archetype.id) &&
    !isModelOutputSufficient(allFiles) &&
    filterRenderableBuildFiles(allFiles).length < MIN_FULL_SCAFFOLD_FILES
  ) {
    const forcedScaffold = applyArchetypeScaffoldFallback(
      archetype.id,
      allFiles,
      resolvedAppName,
      scaffoldOpts,
    );
    if (forcedScaffold.afterCount >= MIN_FULL_SCAFFOLD_FILES) {
      allFiles = forcedScaffold.files;
      scaffoldFallback = forcedScaffold;
      track(events, "writing", "Filling missing pages…", `${forcedScaffold.afterCount} files`);
    }
  }

  if (smokeBuild && hasFullScaffoldTree(archetype.id)) {
    const preContractStub = replaceStubFilesWithArchetypeScaffold(archetype.id, allFiles, resolvedAppName);
    if (preContractStub.replaced > 0) {
      allFiles = preContractStub.files;
      scaffoldFallback = { ...scaffoldFallback, usedFallback: true };
    }
  }

  const importRepair = repairGeneratedImportGraph(allFiles);
  allFiles = importRepair.files;

  if (input.buildTrace) traceBuildWorkerStage(input.buildTrace, "contract_started");
  let enforced = enforcePostBuildContractWithRepair(
    {
      files: allFiles,
      appName: resolvedAppName,
      hasIcon,
      routeMap: designBrief.routes ?? planParsed?.pages?.map(String) ?? null,
      requiredPageSlugs: requiredSlugs,
      tier,
      projectId: input.projectId,
      ownerId: input.userId,
      appType: archetypeToLegacyAppType(archetype.id),
      scaffoldFallbackUsed: scaffoldFallback.usedFallback,
      archetypeId: archetype.id,
    },
    3,
  );

  if (
    smokeBuild &&
    !enforced.contract.passed &&
    hasFullScaffoldTree(archetype.id) &&
    !isModelOutputSufficient(enforced.files)
  ) {
    scaffoldFallback = applyArchetypeScaffoldFallback(
      archetype.id,
      enforced.files,
      resolvedAppName,
      scaffoldOpts,
    );
    if (scaffoldFallback.usedFallback) {
      track(events, "repairing", "Strengthening the app structure…");
      const retry = enforcePostBuildContractWithRepair(
        {
          files: scaffoldFallback.files,
          appName: resolvedAppName,
          hasIcon: true,
          routeMap: designBrief.routes ?? planParsed?.pages?.map(String) ?? null,
          requiredPageSlugs: requiredSlugs,
          tier,
          projectId: input.projectId,
          ownerId: input.userId,
          appType: archetypeToLegacyAppType(archetype.id),
          scaffoldFallbackUsed: true,
          archetypeId: archetype.id,
        },
        1,
      );
      if (retry.contract.passed) {
        allFiles = retry.files;
        Object.assign(enforced, retry);
        scaffoldFallback = { ...scaffoldFallback, usedFallback: true };
      }
    }
  }

  allFiles = enforced.files;
  let sourceIntegrity = evaluateSourceIntegrity(allFiles);
  if (!sourceIntegrity.sourceIntegrityOk && hasFullScaffoldTree(archetype.id)) {
    const finalRootRepair = repairRootPageContent(archetype.id, allFiles, resolvedAppName);
    allFiles = finalRootRepair.files;
    sourceIntegrity = finalRootRepair.integrityAfterRepair;
    enforced = {
      ...enforced,
      files: allFiles,
      contract: {
        ...enforced.contract,
        passed: enforced.contract.passed && sourceIntegrity.sourceIntegrityOk,
      },
    };
  }

  if (input.buildTrace) {
    const contractLabel = enforced.contract.passed && sourceIntegrity.sourceIntegrityOk ? "passed" : "needs_repair";
    traceBuildWorkerStage(input.buildTrace, "contract_completed", contractLabel);
  }
  const postContract = enforced.contract;
  const buildContract: BuildSuccessContractResult = postContract.buildContract;
  uiQuality = postContract.uiQuality;

  const renderableFinalCount = filterRenderableBuildFiles(allFiles).length;
  if (renderableFinalCount === 0) {
    if (hasFullScaffoldTree(archetype.id)) {
      const lastResort = applyArchetypeScaffoldFallback(
        archetype.id,
        [],
        resolvedAppName,
        { allowFullScaffold: true },
      );
      if (lastResort.afterCount > 0) {
        allFiles = lastResort.files;
        scaffoldFallback = lastResort;
        sourceIntegrity = evaluateSourceIntegrity(allFiles);
      }
    }
    if (filterRenderableBuildFiles(allFiles).length === 0) {
      const failureDetail = [
        `archetype=${archetype.id}`,
        `scaffold_used=${scaffoldFallback.usedFallback}`,
        `scaffold_reason=${scaffoldFallback.reason}`,
        `before_fallback=${scaffoldFallback.beforeCount}`,
        `after_fallback=${scaffoldFallback.afterCount}`,
        `contract_failures=${postContract.failures.slice(0, 6).join(",")}`,
      ].join("; ");
      track(events, "failed", "No source files were generated");
      return {
        ok: false,
        visibleText:
          "We could not generate any app source files for this build. Your credits were returned — please try again.",
        meta: null,
        iconSvg: iconSvg || null,
        iconUrl: identityResult.iconUrl,
        appName: resolvedAppName,
        files: [],
        events,
        totalProviderCostUsd: accumulatedCost,
        totalInputTokens: totalIn,
        totalOutputTokens: totalOut,
        primaryModelId,
        complexity,
        uiQualityScore: 0,
        dashboardQualityScore: 0,
        uiRichnessPasses: false,
        buildContract: {
          passed: false,
          allowed: false,
          failures: ["no_source_files_generated"],
          renderableCount: 0,
          pageCount: 0,
          uiQualityScore: 0,
          previewReady: false,
          userMessage:
            "We could not generate any app source files for this build. Your credits were returned — please try again.",
        },
        errorMessage: `no_source_files_generated:${failureDetail}`,
        appArchetype: archetype.id,
        postBuildFailures: ["no_source_files_generated", ...postContract.failures],
        scaffoldFallbackUsed: scaffoldFallback.usedFallback,
        scaffoldFallbackReason: scaffoldFallback.reason,
        filesBeforeScaffoldFallback: scaffoldFallback.beforeCount,
        filesAfterScaffoldFallback: scaffoldFallback.afterCount,
      };
    }
  }

  generationQualityReport = scoreGeneratedAppQuality({
    files: allFiles,
    budget: generationBudget,
    userPrompt: executionPrompt,
    appType: archetypeToLegacyAppType(archetype.id),
    routeMap: designBrief.routes,
  });
  meaningfulQualityReport = scoreMeaningfulUiQuality({
    files: allFiles,
    budget: generationBudget,
    userPrompt: executionPrompt,
    routeMap: designBrief.routes,
  });
  const routeCheck = checkRouteConnectivity(allFiles);
  const scaffoldFilesCount = Math.max(0, allFiles.length - modelFilesBeforeScaffold);
  const genericScaffoldDetection = detectGenericScaffoldBuild(allFiles);
  const filesRewritten = events.filter((e) => e.meta?.file_rewritten).length;
  const renderableCount = filterRenderableBuildFiles(allFiles).length;
  const importGraphStatus = importRepair.status;
  const missingImportSummary = formatMissingImportsForSummary(importRepair.missingAfter);

  const logoStatusLine =
    identityResult.logoGenerationStatus === "generated"
      ? "Logo generated"
      : identityResult.logoGenerationStatus === "insufficient_credits"
        ? "Temporary fallback icon — image generation skipped: not enough Action Credits"
        : identityResult.logoGenerationStatus === "failed"
          ? `Temporary fallback icon — image generation failed${identityResult.logoGenerationError ? `: ${identityResult.logoGenerationError}` : ""}`
          : identityResult.iconGenerationMode === "skipped_no_openai_key" ||
              identityResult.iconGenerationMode === "skipped_provider_disabled"
            ? "Temporary fallback icon — image provider is not configured"
            : "Temporary fallback icon — not AI-generated";

  const finalSummary = buildSummaryFromQuality(primaryModelId, meaningfulQualityReport, {
    durationMs: Date.now() - pipelineStartedAt,
    attempts: continuationAttemptsTotal,
    filesGenerated: renderableCount,
    filesRewritten,
    routes: meaningfulQualityReport.total_routes,
    components: meaningfulQualityReport.component_count,
    previewStatus: genericScaffoldDetection.isGeneric
      ? "not_started"
      : importGraphStatus === "fail"
        ? "blocked"
        : buildContract.previewReady
          ? "ready"
          : meaningfulQualityReport.passes
            ? "preparing"
            : "warning",
    logoStatus: logoStatusLine,
    genericScaffold: genericScaffoldDetection,
    importGraphStatus,
    blocker:
      genericScaffoldDetection.isGeneric
        ? "generic scaffold detected"
        : importGraphStatus === "fail"
          ? `missing imports (${importRepair.missingAfter.length})`
          : !meaningfulQualityReport.passes
            ? `quality below floor (${meaningfulQualityReport.final_quality_score}/${meaningfulQualityReport.min_required_score})`
            : null,
    nextAction: genericScaffoldDetection.isGeneric
      ? "retry full-app generation with stricter prompt"
      : importGraphStatus === "fail"
        ? "repair import graph before deploy"
        : !meaningfulQualityReport.passes
          ? "continue full-app generation"
          : null,
  });
  trackAssistant(events, finalSummary, emit);

  const ok =
    postContract.passed &&
    sourceIntegrity.sourceIntegrityOk &&
    generationQualityReport.passes &&
    meaningfulQualityReport.passes &&
    !genericScaffoldDetection.isGeneric &&
    importGraphStatus !== "fail" &&
    renderableCount >= generationBudget.minFiles;
  const summaryText = ok
    ? finalSummary
    : genericScaffoldDetection.isGeneric
      ? `Build blocked — generic scaffold detected (${genericScaffoldFailureCode(genericScaffoldDetection)}). Continuing full model generation is required.`
      : generationQualityReport.needsContinuation || !meaningfulQualityReport.passes
        ? finalSummary
        : routeCheck.orphanRoutes.length > 0
          ? `Preview ready with route issues — ${routeCheck.verifiedCount}/${routeCheck.totalCount} routes linked.`
          : finalSummary;

  const modelRuntime = resolveModelRuntime(primaryModelId);

  const meta: BuilderOutputContract = {
    app: {
      name: appName,
      slug: appSlug,
      description: identityResult.shortDescription || planParsed?.summary || "",
      category,
      theme: undefined,
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
      ? buildContract.previewReady
        ? `Build complete — ${resolvedAppName} (${formatQualitySummaryForStream(generationQualityReport)}).`
        : uiQuality.uiRichnessPasses
          ? `Draft generated for ${resolvedAppName} — improving UI quality.`
          : `Draft saved for ${resolvedAppName} — additional generation needed.`
      : summaryText,
    dashboard: undefined,
    publish: undefined,
    preview: undefined,
    steps: [],
  };

  let resultMarkdown = "";
  if (intakeResult && ok && sourceIntegrity.previewRenderable) {
    const backlog = await loadBuildBacklog(input.writer, input.projectId);
    const resultSummary = formatBuildResultSummary({
      appName,
      scope: intakeResult.firstPassScope,
      intake: intakeResult.summary,
      backlog,
      builtScreens: planParsed?.pages?.map(String),
    });
    resultMarkdown = renderBuildResultMarkdown(resultSummary);
    meta.summary = resultSummary.headline;
  } else if (scope.coreV1Only && scope.backlog.length) {
    meta.summary = `${meta.summary} Remaining items are queued as next steps.`;
  }

  const summary = meta.summary ?? "";
  const terminalPhase: BuildTerminalPhase = ok
    ? buildContract.previewReady
      ? "preview_ready"
      : meaningfulQualityReport.passes
        ? "blocked_recoverable"
        : "blocked_recoverable"
    : genericScaffoldDetection.isGeneric || renderableCount === 0
      ? "blocked_final"
      : "failed_final";
  if (ok) {
    setBuildPhase("preview_ready", "done", summary, finalSummary, {
      continuation_attempt: continuationAttemptsTotal,
    });
  } else {
    setBuildPhase(terminalPhase, "failed", summaryText || "Build needs another pass before preview.", finalSummary, {
      continuation_attempt: continuationAttemptsTotal,
    });
  }

  if (input.buildJobId) {
    const { data: jobRow } = await input.writer
      .from("build_jobs")
      .select("meta, prompt, conversation_id")
      .eq("id", input.buildJobId)
      .maybeSingle();
    const prevJobMeta =
      jobRow?.meta && typeof jobRow.meta === "object" && !Array.isArray(jobRow.meta)
        ? (jobRow.meta as Record<string, unknown>)
        : {};
    const pipelineMeta = {
      ...prevJobMeta,
      user_prompt:
        featureExpansion.originalPrompt ||
        (typeof prevJobMeta.user_prompt === "string" ? prevJobMeta.user_prompt : null) ||
        (typeof jobRow?.prompt === "string" ? jobRow.prompt : null) ||
        input.userPrompt,
      expanded_prompt: featureExpansion.expanded ? featureExpansion.executionPrompt : undefined,
      feature_expansion_count: featureExpansion.expanded ? featureExpansion.addedFeatures.length : 0,
      operation_id: input.operationId,
      conversation_id: input.conversationId ?? jobRow?.conversation_id ?? prevJobMeta.conversation_id,
      mode_at_submit:
        (typeof prevJobMeta.mode_at_submit === "string" ? prevJobMeta.mode_at_submit : null) ??
        "build",
      primary_model_id: primaryModelId,
      pipeline: "staged",
      complexity,
      provider_cost_usd: accumulatedCost,
      workflow_events: events.map((ev) => ({
        type: ev.type,
        label: ev.label,
        at: ev.at,
        detail: ev.detail && ev.detail.length > 2000 ? `${ev.detail.slice(0, 2000)}…` : ev.detail,
        meta: ev.meta,
      })) as unknown as Json,
      ui_quality_score: uiQuality.score,
      dashboard_quality_score: uiQuality.dashboardScore,
      ui_richness_score: uiQuality.uiRichnessScore,
      ui_richness_passes: uiQuality.uiRichnessPasses,
      product_intelligence_headline: productIntel.brief.headline,
      ui_preview_ready: buildContract.previewReady,
      build_success_contract: buildContract.passed,
      build_contract_failures: buildContract.failures,
      post_build_repair_passes: enforced.repairPasses,
      app_archetype: archetype.id,
      scaffold_fallback_used: scaffoldFallback.usedFallback,
      scaffold_fallback_reason: scaffoldFallback.reason,
      files_before_scaffold_fallback: scaffoldFallback.beforeCount,
      files_after_scaffold_fallback: scaffoldFallback.afterCount,
      model_files_count: modelFilesBeforeScaffold,
      scaffold_files_count: scaffoldFilesCount,
      generation_quality_score: generationQualityReport.score,
      generation_quality_passes: generationQualityReport.passes,
      generation_tier: generationBudget.tier,
      route_connectivity_verified: routeCheck.verifiedCount,
      route_connectivity_total: routeCheck.totalCount,
      generation_quality_failures: generationQualityReport.failures,
      user_selected_model_label: modelRuntime.userSelectedModelLabel,
      actual_provider: modelRuntime.actualProvider,
      actual_model_id: modelRuntime.actualModelId,
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

  if (traceCollector && input.buildJobId) {
    const streamHealth = computeStreamHealthFromEvents(events, pipelineStartedAt);
    const artifact = finalizeBuildTraceArtifact({
      collector: traceCollector,
      parsedFileCount: renderableCount,
      parsedRouteCount: meaningfulQualityReport.total_routes,
      parsedComponentCount: meaningfulQualityReport.component_count,
      modelFileCount: modelFilesBeforeScaffold,
      scaffoldFileCount: scaffoldFilesCount,
      fallbackUsed: scaffoldFallback.usedFallback,
      fallbackReason: scaffoldFallback.usedFallback ? scaffoldFallback.reason : null,
      genericScaffold: genericScaffoldDetection,
      meaningfulQuality: meaningfulQualityReport,
      logoAttempted: identityResult.logoGenerationStatus !== "skipped",
      logoStatus: identityResult.logoGenerationStatus,
      logoFailureReason: identityResult.logoGenerationError,
      importGraphStatus,
      missingImports: missingImportSummary,
      previewStartAttempted: false,
      previewStatus: genericScaffoldDetection.isGeneric ? "not_started" : null,
      streamHealth,
    });
    await persistBuildTraceArtifact(input.writer, input.buildJobId, artifact).catch(() => undefined);
  }

  await logServerOperation({
    writer: input.writer,
    userId: input.userId,
    userEmail: input.userEmail,
    stage: "build",
    event: ok ? "build_pipeline_success" : "build_pipeline_failed",
    status: ok ? "ok" : "error",
    mode: "build",
    modelId: primaryModelId,
    projectId: input.projectId,
    buildJobId: input.buildJobId,
    operationId: input.operationId,
    errorMessage: ok
      ? null
      : buildContract.failures.join("; ") || summaryText || "build_contract_failed",
    metadata: {
      files: allFiles.length,
      renderable: buildContract.renderableCount,
      contract_passed: buildContract.passed,
      provider_cost_usd: accumulatedCost,
      output_tokens: totalOut,
      user_selected_model_label: modelRuntime.userSelectedModelLabel,
      actual_provider: modelRuntime.actualProvider,
      actual_model_id: modelRuntime.actualModelId,
      post_build_repair_passes: enforced.repairPasses,
    },
  });

  return {
    ok,
    visibleText: resultMarkdown
      ? `${buildVisibleNarrative(meta, events, summary, allFiles)}\n\n${resultMarkdown}`
      : buildVisibleNarrative(meta, events, summary, allFiles),
    meta,
    iconSvg: iconSvg || null,
    iconUrl: identityResult.iconUrl,
    appName: resolvedAppName,
    files: allFiles,
    events,
    totalProviderCostUsd: accumulatedCost,
    totalInputTokens: totalIn,
    totalOutputTokens: totalOut,
    primaryModelId,
    complexity,
    uiQualityScore: uiQuality.score,
    dashboardQualityScore: uiQuality.dashboardScore,
    uiRichnessPasses: uiQuality.uiRichnessPasses,
    buildContract,
    postBuildFailures: postContract.failures,
    appArchetype: archetype.id,
    errorMessage: ok ? undefined : buildContract.failures.join("; ") || summaryText,
    scaffoldFallbackUsed: scaffoldFallback.usedFallback,
    scaffoldFallbackReason: scaffoldFallback.usedFallback ? scaffoldFallback.reason : undefined,
    filesBeforeScaffoldFallback: scaffoldFallback.beforeCount,
    filesAfterScaffoldFallback: scaffoldFallback.afterCount,
    generationQualityReport,
    meaningfulQualityReport,
    genericScaffoldDetection,
    buildFinalSummary: finalSummary,
    generationBudget,
    modelFilesCount: modelFilesBeforeScaffold,
    scaffoldFilesCount,
  };
}
