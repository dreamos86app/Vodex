import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { runStagedBuildPipeline } from "@/lib/build/build-pipeline";
import { buildDomainOpenerFromPrompt } from "@/lib/build/build-domain-narration";
import {
  buildModelHonestyLogFields,
  validateBuildModelSelection,
} from "@/lib/ai/model-selection-honesty";
import { evaluateProductionCompletionGate } from "@/lib/build/app-completion-gate";
import { saveAppVersionSnapshot } from "@/lib/projects/app-version-history";
import {
  calculateCreditsForStagedBuild,
  resolveStagedBuildChargeCredits,
} from "@/lib/credits/credit-pricing";
import { reconcileGenerationReservation } from "@/lib/billing/credit-reservations";
import { finalizeBuildSuccess, finalizeBuildFailed } from "@/lib/build/finalize-build";
import { finalizeBuildPartial } from "@/lib/build/finalize-build-partial";
import {
  userFacingPartialStopMessage,
  workflowEventCreditStageCost,
} from "@/lib/billing/partial-build-credits";
import { filterRenderableBuildFiles } from "@/lib/build/generated-file-utils";
import { getAppUrl } from "@/lib/app-url";
import { hasSuccessfulChargeForOperation } from "@/lib/chat/server-idempotency";
import {
  clearGeneratedBuildFiles,
  persistGeneratedBuildFiles,
  persistIncrementalBuildFile,
} from "@/lib/build/persist-generated-files";
import { assertBuildFilesPersisted } from "@/lib/build/assert-build-files-persisted";
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";
import { canCompleteWithSavedFiles } from "@/lib/build/post-build-contract";
import { startPreviewSession } from "@/lib/preview/preview-build-service";
import { buildProjectPreviewHtmlDetailed } from "@/lib/preview/project-preview-html";
import { validateBuildTsxSources } from "@/lib/build/tsx-source-validator";
import { lifecyclePatch } from "@/lib/projects/project-lifecycle";
import {
  persistAssistantBuildMessage,
  persistBuildJobEvent,
  persistWorkflowEvent,
} from "@/lib/build/build-job-events";
import {
  failureKindForPersist,
  userSafeFailureDetail,
  userSafeFailureTitle,
} from "@/lib/build/workflow-status-guards";
import {
  resolveBuildTerminalTruth,
  truthFailureKindForPersist,
} from "@/lib/build/build-terminal-truth";
import { logServerOperation } from "@/lib/ops/server-ops-log";
import { normalizeBuildError } from "@/lib/build/build-error";
import {
  claimBuildJobWorker,
  createBuildWorkerContext,
  transitionBuildJobStatus,
} from "@/lib/build/build-job-terminal";
import { tracePersistGeneratedFiles } from "@/lib/build/files-persist-trace";
import { reconcilePostPersistBuildStatus } from "@/lib/build/post-persist-status-reconciler";
import {
  createBuildWorkerTrace,
  clearBuildWorkerTrace,
  getBuildWorkerTrace,
  persistTraceStage,
  setTraceHeartbeatRunning,
  traceBuildWorkerStage,
} from "@/lib/build/build-worker-trace";
import { writeWorkerStallSnapshot } from "@/lib/build/worker-stall-snapshot";
import {
  emitPreviewWorkflowEvent,
  emitRepairWorkflowEvent,
} from "@/lib/build/workflow-live-events";
import {
  classifyPreviewFailure,
  isPreviewFailureCode,
  mapLegacyPreviewErrorCode,
  userMessageForPreviewFailure,
  type PreviewFailureCode,
} from "@/lib/preview/preview-failure-codes";
import { runDeterministicPreviewRepair, isPreviewRepairEligible } from "@/lib/build/preview-deterministic-repair";
import { classifyPreviewBuildFailure } from "@/lib/preview/preview-failure-classifier";
import { loadLatestPreviewDiagnostics } from "@/lib/imports/runtime-build-runner";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  buildLatestPreviewFailureRecord,
  persistLatestPreviewFailure,
} from "@/lib/preview/persist-preview-failure-metadata";
import { countAppRoutes } from "@/lib/build/route-connectivity-check";
import { detectGenericScaffoldBuild } from "@/lib/build/generic-scaffold-detector";
import { isProductionBuildMode } from "@/lib/build/build-production-mode";
import {
  analyzePreviewHtml,
  isStaticPreviewSnapshotHealthy,
} from "@/lib/preview/preview-html-diagnostics";
import { startValidationWatchdog } from "@/lib/build/validation-watchdog";
import { BUILD_USER_TIMEOUT_MS } from "@/lib/build/build-step-ui";
import { loadAllProjectAppFiles } from "@/lib/projects/load-all-app-files";

type Writer = SupabaseClient<Database>;

function isPreviewGateFailed(
  html: string,
  files: Array<{ path: string; content: string }>,
  previewSessionOk: boolean,
): boolean {
  return !analyzePreviewHtml(html, files, { previewSessionOk }).previewRenderable;
}

/** Prevents duplicate `after()` invocations from running two pipelines on one job (dev server). */
const inFlightBuildJobs = new Set<string>();

export type ExecuteStagedBuildJobInput = {
  writer: Writer;
  userId: string;
  userEmail: string;
  operationId: string;
  projectId: string;
  buildJobId: string;
  userPrompt: string;
  memoryBlock: string;
  conversationId?: string;
  modelId: string;
  reservedCredits?: number;
  partialCreditBuild?: boolean;
  quotedCreditsRequired?: number;
  blueprintBlock?: string;
  userSelectedModelId?: string | null;
  resumeContinuation?: boolean;
};

async function chargeStagedBuildIfNeeded(input: {
  writer: Writer;
  userId: string;
  operationId: string;
  projectId: string;
  reservedCredits?: number;
  chargeCalc: ReturnType<typeof calculateCreditsForStagedBuild>;
  complexity: number;
}): Promise<number> {
  if (!input.reservedCredits || input.reservedCredits <= 0) return 0;
  const actualUserCredits = resolveStagedBuildChargeCredits({
    chargeCalc: input.chargeCalc,
    reservedCredits: input.reservedCredits,
    complexity: input.complexity,
  });
  if (actualUserCredits <= 0) return 0;
  const recon = await reconcileGenerationReservation(input.writer, {
    userId: input.userId,
    generationId: input.operationId,
    reservedCredits: input.reservedCredits,
    actualUserCredits,
    providerCostUsd: input.chargeCalc.estimatedProviderCostUsd,
    success: true,
    projectId: input.projectId,
  });
  return recon.finalCharged;
}

async function refundBuildReservation(input: {
  writer: Writer;
  userId: string;
  operationId: string;
  reservedCredits?: number;
  providerCostUsd: number;
  projectId: string;
  buildJobId: string;
}) {
  if (!input.reservedCredits || input.reservedCredits <= 0) return;
  await reconcileGenerationReservation(input.writer, {
    userId: input.userId,
    generationId: input.operationId,
    reservedCredits: input.reservedCredits,
    actualUserCredits: 0,
    providerCostUsd: input.providerCostUsd,
    success: false,
    projectId: input.projectId,
  }).catch(() => undefined);
  await persistBuildJobEvent(input.writer, {
    jobId: input.buildJobId,
    projectId: input.projectId,
    userId: input.userId,
    type: "refunded",
    title: "Credits returned",
    detail: "Reserved credits were returned for this attempt.",
    metadata: { stream_category: "assistant_message" },
    progressPercent: 100,
  });
}

/** Runs staged build in background after /api/chat returns. */
export async function executeStagedBuildJob(input: ExecuteStagedBuildJobInput): Promise<void> {
  if (inFlightBuildJobs.has(input.buildJobId)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[execute-staged-build] duplicate worker skipped", input.buildJobId);
    }
    return;
  }
  inFlightBuildJobs.add(input.buildJobId);
  let buildFinishedSuccess = false;
  let jobClaimed = false;
  const workerCtx = createBuildWorkerContext(input.operationId);

  const eventCtx = {
    jobId: input.buildJobId,
    projectId: input.projectId,
    userId: input.userId,
  };

  const trace = createBuildWorkerTrace({
    buildJobId: input.buildJobId,
    operationId: input.operationId,
    executionInstanceId: workerCtx.executionInstanceId,
    projectId: input.projectId,
  });

  let stepIndex = 0;
  const progressForStep = () => Math.min(95, 8 + stepIndex * 4);
  let lastActivityAt = Date.now();
  let currentStepLabel = "Creating the app plan";
  let lastHeartbeatPersist = 0;
  let heartbeatTick = 0;

  const persistStage = async (
    stage: Parameters<typeof traceBuildWorkerStage>[1],
    detail?: string,
  ) => {
    traceBuildWorkerStage(trace, stage, detail);
    await persistTraceStage(input.writer, {
      ...eventCtx,
      snap: trace,
      stage,
      detail,
    }).catch(() => undefined);
    lastActivityAt = Date.now();
  };

  setTraceHeartbeatRunning(trace, true);
  const heartbeat = setInterval(() => {
    if (Date.now() - lastActivityAt < 10_000) return;
    if (Date.now() - lastHeartbeatPersist < 10_000) return;
    lastHeartbeatPersist = Date.now();
    heartbeatTick += 1;
    const snap = getBuildWorkerTrace(input.buildJobId);
    const stageLabel = snap?.lastStage ?? "working";
    const modelPending = snap?.modelCall?.state === "pending";
    const modelOp = snap?.modelCall?.operationType?.replace(/_/g, " ") ?? "model response";
    const elapsedSec = Math.max(1, Math.floor((Date.now() - lastActivityAt) / 1000));
    const heartbeatTitle = modelPending
      ? `Generating ${modelOp}… ${elapsedSec}s`
      : `${currentStepLabel}… ${elapsedSec}s`;
    void persistBuildJobEvent(input.writer, {
      ...eventCtx,
      type: "planning_app",
      title: heartbeatTitle,
      detail: heartbeatTitle,
      progressPercent: progressForStep(),
      metadata: {
        trace_stage: stageLabel,
        heartbeat: true,
        hidden: true,
        stream_category: "phase_progress",
        build_stage: stageLabel,
        build_terminal_phase: modelPending ? "model_generating" : "continuation_running",
        operation_id: input.operationId,
        execution_instance_id: workerCtx.executionInstanceId,
        heartbeat_tick: heartbeatTick,
        heartbeat_elapsed_sec: elapsedSec,
      },
    }).catch(() => {});
    void input.writer
      .from("build_jobs")
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", input.buildJobId)
      .then(() => undefined, () => undefined);
  }, 10_000);

  const PIPELINE_HARD_CAP_MS = Number(
    process.env.DREAMOS_PIPELINE_HARD_CAP_MS ?? BUILD_USER_TIMEOUT_MS + 60_000,
  );
  const BUILD_NO_FILE_STALL_MS = Number(process.env.DREAMOS_BUILD_NO_FILE_STALL_MS ?? 120_000);
  const pipelineStartedAt = Date.now();
  let filesSeenInPipeline = false;

  try {
    await persistStage("worker_claim_attempt");
    const claim = await claimBuildJobWorker(input.writer, input.buildJobId, workerCtx);
    if (!claim.claimed) {
      await persistStage("worker_claim_failed", claim.error ?? "not_claimed");
      if (process.env.NODE_ENV !== "production") {
        console.warn("[execute-staged-build] job already claimed or claim failed", {
          buildJobId: input.buildJobId,
          error: claim.error,
        });
      }
      return;
    }
    jobClaimed = true;
    await persistStage("worker_claimed");
    await persistStage("build_pipeline_entered");
    await persistStage("planning_app_started", "Organizing screens and features");
    const modelValidation = await validateBuildModelSelection({
      modelId: input.userSelectedModelId ?? input.modelId,
      buildCreditsAvailable: input.reservedCredits ?? 999,
    });
    await persistBuildJobEvent(input.writer, {
      ...eventCtx,
      type: "planning_app",
      title: "Build worker ready",
      detail: modelValidation.honestDisplayName,
      metadata: {
        ...buildModelHonestyLogFields(modelValidation),
        stream_category: "phase_started",
      },
    }).catch(() => undefined);
    const opener = input.resumeContinuation
      ? "Continuing generation from where we left off — route-by-route."
      : input.userPrompt?.trim()
        ? buildDomainOpenerFromPrompt(input.userPrompt)
        : "I'll map your app architecture, generate screens, save files, and prepare preview.";
    await persistAssistantBuildMessage(input.writer, eventCtx, {
      message: opener,
      progressPercent: 10,
    }).catch(() => undefined);

    const creditTracker = {
      used: 0,
      budget: input.partialCreditBuild ? Math.max(1, input.reservedCredits ?? 0) : Infinity,
      stop: false,
    };

    const pipelinePromise = runStagedBuildPipeline({
      writer: input.writer,
      userId: input.userId,
      userEmail: input.userEmail,
      operationId: input.operationId,
      projectId: input.projectId,
      buildJobId: input.buildJobId,
      userPrompt: input.userPrompt,
      memoryBlock: input.memoryBlock,
      blueprintBlock: input.blueprintBlock,
      conversationId: input.conversationId,
      userSelectedModelId: input.userSelectedModelId ?? input.modelId,
      buildTrace: trace,
      shouldStopForCredits: () => creditTracker.stop,
      resumeContinuation: input.resumeContinuation === true,
      routeByRouteOnly: input.resumeContinuation === true,
      onWorkflowEvent: async (ev) => {
        lastActivityAt = Date.now();
        if (ev.type === "writing" || ev.meta?.filePath || ev.meta?.streamCategory === "file_created") {
          filesSeenInPipeline = true;
        }
        currentStepLabel = ev.label;
        if (ev.type !== "thinking" && ev.type !== "writing" && ev.type !== "editing") {
          stepIndex += 1;
        }
        if (input.partialCreditBuild && Number.isFinite(creditTracker.budget)) {
          creditTracker.used += workflowEventCreditStageCost(ev.type);
          if (creditTracker.used >= creditTracker.budget) {
            creditTracker.stop = true;
          }
        }
        await persistWorkflowEvent(input.writer, eventCtx, ev, progressForStep());
      },
      onFileCommitted: async (file) => {
        filesSeenInPipeline = true;
        lastActivityAt = Date.now();
        await persistIncrementalBuildFile({
          writer: input.writer,
          projectId: input.projectId,
          ownerId: input.userId,
          file,
          operationId: input.operationId,
          executionInstanceId: workerCtx.executionInstanceId,
        }).catch(() => false);
      },
    });

    let pr = await Promise.race([
      pipelinePromise,
      new Promise<Awaited<typeof pipelinePromise>>((_, reject) => {
        setTimeout(
          () => reject(new Error("build_pipeline_hard_cap_exceeded")),
          PIPELINE_HARD_CAP_MS,
        );
      }),
      new Promise<Awaited<typeof pipelinePromise>>((_, reject) => {
        const tick = setInterval(() => {
          const elapsed = Date.now() - pipelineStartedAt;
          if (!filesSeenInPipeline && elapsed >= BUILD_NO_FILE_STALL_MS) {
            clearInterval(tick);
            reject(new Error("build_no_files_stall"));
          }
        }, 5_000);
        pipelinePromise.finally(() => clearInterval(tick)).catch(() => clearInterval(tick));
      }),
    ]).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("no_files_stall")) {
        return {
          ok: false,
          visibleText:
            "Build paused — no files were generated in time. Use Continue generation to resume route-by-route.",
          meta: null,
          iconSvg: null,
          iconUrl: null,
          appName: "Dream App",
          files: [] as never[],
          events: [],
          totalProviderCostUsd: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          primaryModelId: input.modelId,
          complexity: 1,
          uiQualityScore: 0,
          dashboardQualityScore: 0,
          uiRichnessPasses: false,
          buildContract: {
            passed: false,
            allowed: false,
            failures: ["build_no_files_stall"],
            renderableCount: 0,
            pageCount: 0,
            uiQualityScore: 0,
            previewReady: false,
            userMessage: "Build paused — no files generated yet.",
          },
          postBuildFailures: ["build_no_files_stall"],
          appArchetype: "unknown",
          errorMessage: msg,
        } satisfies Awaited<typeof pipelinePromise>;
      }
      if (msg.includes("hard_cap")) {
        return {
          ok: false,
          visibleText: "Build timed out — use Continue generation or try Automatic model.",
          meta: null,
          iconSvg: null,
          iconUrl: null,
          appName: "Dream App",
          files: [] as never[],
          events: [],
          totalProviderCostUsd: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          primaryModelId: input.modelId,
          complexity: 1,
          uiQualityScore: 0,
          dashboardQualityScore: 0,
          uiRichnessPasses: false,
          buildContract: {
            passed: false,
            allowed: false,
            failures: ["build_pipeline_hard_cap"],
            renderableCount: 0,
            pageCount: 0,
            uiQualityScore: 0,
            previewReady: false,
            userMessage: "Build timed out before completion.",
          },
          postBuildFailures: ["build_pipeline_hard_cap"],
          appArchetype: "unknown",
          errorMessage: msg,
        } satisfies Awaited<typeof pipelinePromise>;
      }
      throw err;
    });

    if (
      pr.errorMessage?.includes("hard_cap") &&
      filterRenderableBuildFiles(pr.files).length < MIN_RENDERABLE_FILES
    ) {
      const persisted = await loadAllProjectAppFiles(input.writer, input.projectId).catch(
        () => [],
      );
      const recovered = filterRenderableBuildFiles(
        persisted.map((f) => ({
          path: f.path,
          content: f.content,
          language: f.path.split(".").pop(),
        })),
      );
      if (recovered.length >= MIN_RENDERABLE_FILES) {
        pr = {
          ...pr,
          ok: true,
          files: recovered,
          visibleText:
            "Build reached the time limit — saved progress and preparing preview. Use Continue generation for remaining routes.",
          buildContract: {
            ...pr.buildContract,
            passed: true,
            allowed: true,
            renderableCount: recovered.length,
            previewReady: true,
            failures: pr.buildContract.failures.filter((f) => f !== "build_pipeline_hard_cap"),
            userMessage: "Saved partial build — preview preparing.",
          },
          postBuildFailures: (pr.postBuildFailures ?? []).filter(
            (f) => f !== "build_pipeline_hard_cap",
          ),
          errorMessage: undefined,
        };
      }
    }

    const alreadyCharged = await hasSuccessfulChargeForOperation(
      input.writer,
      input.userId,
      input.operationId,
    );

    if (input.conversationId && pr.visibleText) {
      await input.writer.from("messages").insert({
        conversation_id: input.conversationId,
        user_id: input.userId,
        role: "assistant",
        content: pr.visibleText,
        model_id: pr.primaryModelId,
        credits_used: 0,
        finish_reason: pr.ok ? "stop" : "error",
        tokens_input: pr.totalInputTokens,
        tokens_output: pr.totalOutputTokens,
        metadata: {
          mode: "build",
          staged: true,
          async: true,
          build_success: pr.ok,
          build_job_id: input.buildJobId,
        } as never,
      });
    }

    const saveableFileCount = filterRenderableBuildFiles(pr.files).length;
    const totalRawFiles = pr.files.length;
    const allContractFailures = [
      ...new Set([...pr.buildContract.failures, ...(pr.postBuildFailures ?? [])]),
    ];
    const genericScaffold = detectGenericScaffoldBuild(pr.files);
    const meaningfulReport =
      "meaningfulQualityReport" in pr ? pr.meaningfulQualityReport : undefined;
    const generationBudget =
      "generationBudget" in pr ? pr.generationBudget : undefined;
    const minMeaningfulFiles = generationBudget?.minFiles ?? 35;
    const genericBlock = genericScaffold.isGeneric;
    const insufficientFiles =
      saveableFileCount < MIN_RENDERABLE_FILES && totalRawFiles < MIN_RENDERABLE_FILES;
    const modelUnderproduced =
      isProductionBuildMode() &&
      totalRawFiles > 0 &&
      totalRawFiles < 12 &&
      saveableFileCount < minMeaningfulFiles;
    const qualitySoftBlock =
      isProductionBuildMode() &&
      !genericBlock &&
      !insufficientFiles &&
      (modelUnderproduced ||
        (meaningfulReport != null && !meaningfulReport.passes) ||
        saveableFileCount < minMeaningfulFiles);
    const qualityHardBlock = genericBlock || insufficientFiles;
    const qualityBlocked = qualityHardBlock || qualitySoftBlock;
    if (genericScaffold.isGeneric) {
      allContractFailures.push(`generic_scaffold_detected:${genericScaffold.reasons.join(",")}`);
    }
    const completionGate = evaluateProductionCompletionGate(pr.files, input.userPrompt ?? "");
    if (completionGate.shouldContinue) {
      allContractFailures.push(`completion_gate:${completionGate.domain ?? "app"}`);
    }
    let buildSucceeded =
      !qualityHardBlock &&
      ((pr.ok && pr.buildContract.passed) ||
        canCompleteWithSavedFiles(saveableFileCount, allContractFailures, {
          genericScaffold: genericScaffold.isGeneric,
          minMeaningfulFiles: isProductionBuildMode() ? minMeaningfulFiles : undefined,
          qualityPasses: meaningfulReport?.passes,
        }) ||
        qualitySoftBlock);

    if (completionGate.shouldContinue && saveableFileCount > 0) {
      buildSucceeded = qualitySoftBlock || saveableFileCount >= MIN_RENDERABLE_FILES;
      await persistAssistantBuildMessage(input.writer, eventCtx, {
        message: completionGate.userMessage || "Continuing app completion…",
        metadata: {
          continuing_generation_needed: true,
          completion_gate: completionGate.domain,
          missing: completionGate.missing,
        },
      }).catch(() => undefined);
    }

    const partialCreditStop =
      ("partialCreditStop" in pr && pr.partialCreditStop === true) ||
      pr.errorMessage === "partial_credit_stop";

    if (
      !buildSucceeded &&
      input.partialCreditBuild &&
      (partialCreditStop || saveableFileCount > 0)
    ) {
      const creditsUsed = Math.max(
        1,
        Math.min(input.reservedCredits ?? 1, creditTracker.used || (input.reservedCredits ?? 1)),
      );
      const partialMessage = userFacingPartialStopMessage(
        Math.floor(creditsUsed) || input.reservedCredits || 1,
      );

      await persistStage("persist_started", `${pr.files.length} files in memory`);
      const { result: persist } = await tracePersistGeneratedFiles({
        writer: input.writer,
        projectId: input.projectId,
        ownerId: input.userId,
        files: pr.files,
        operationId: input.operationId,
        executionInstanceId: workerCtx.executionInstanceId,
      });

      await persistStage("persist_completed", `${persist.savedCount} files written`);

      if (!alreadyCharged) {
        await chargeStagedBuildIfNeeded({
          writer: input.writer,
          userId: input.userId,
          operationId: input.operationId,
          projectId: input.projectId,
          reservedCredits: input.reservedCredits,
          chargeCalc: calculateCreditsForStagedBuild({
            providerCostUsd: pr.totalProviderCostUsd,
            complexity: pr.complexity,
            inputTokens: pr.totalInputTokens,
            outputTokens: pr.totalOutputTokens,
            primaryModelId: pr.primaryModelId,
            fileCount: Math.max(persist.savedCount, saveableFileCount),
          }),
          complexity: pr.complexity,
        });
      }

      if (persist.savedCount > 0) {
        await persistStage("source_integrity_passed", `${persist.savedCount} files saved`);
      }

      await finalizeBuildPartial({
        writer: input.writer,
        userId: input.userId,
        projectId: input.projectId,
        buildJobId: input.buildJobId,
        workerCtx,
        appName: pr.appName,
        meta: pr.meta,
        fileCount: Math.max(persist.savedCount, saveableFileCount),
        creditsUsed: Math.floor(creditsUsed),
        remainingSummary: partialMessage,
        skipJobStatusUpdate: false,
      });

      if (input.conversationId) {
        await input.writer.from("messages").insert({
          conversation_id: input.conversationId,
          user_id: input.userId,
          role: "assistant",
          content: partialMessage,
          model_id: pr.primaryModelId,
          credits_used: Math.floor(creditsUsed),
          finish_reason: "stop",
          metadata: {
            mode: "build",
            staged: true,
            async: true,
            partial_needs_more_credits: true,
            build_job_id: input.buildJobId,
          } as never,
        });
      }

      await persistBuildJobEvent(input.writer, {
        ...eventCtx,
        type: "partial_credit_stop",
        title: "Saved partial progress",
        detail: partialMessage,
        progressPercent: 100,
        metadata: {
          credits_used: Math.floor(creditsUsed),
          files_persisted: persist.savedCount,
          terminal: "partial_needs_more_credits",
        },
      });

      await logServerOperation({
        writer: input.writer,
        userId: input.userId,
        userEmail: input.userEmail,
        stage: "build",
        event: "async_build_partial_credit_stop",
        status: "ok",
        mode: "build",
        modelId: pr.primaryModelId,
        projectId: input.projectId,
        buildJobId: input.buildJobId,
        operationId: input.operationId,
        metadata: {
          files: persist.savedCount,
          credits_used: Math.floor(creditsUsed),
        },
      });
      buildFinishedSuccess = true;
      return;
    }

    const noFilesStall = pr.postBuildFailures?.includes("build_no_files_stall") === true;
    if (!buildSucceeded && noFilesStall) {
      const stallSummary =
        pr.visibleText ??
        "Build paused — no files were generated in time. Use Continue generation to resume route-by-route.";

      await refundBuildReservation({
        writer: input.writer,
        userId: input.userId,
        operationId: input.operationId,
        reservedCredits: input.reservedCredits,
        providerCostUsd: pr.totalProviderCostUsd,
        projectId: input.projectId,
        buildJobId: input.buildJobId,
      });

      const { data: stallProj } = await input.writer
        .from("projects")
        .select("metadata")
        .eq("id", input.projectId)
        .maybeSingle();
      const stallMeta =
        stallProj?.metadata && typeof stallProj.metadata === "object" && !Array.isArray(stallProj.metadata)
          ? (stallProj.metadata as Record<string, unknown>)
          : {};

      await input.writer
        .from("projects")
        .update({
          build_status: "needs_repair",
          metadata: {
            ...stallMeta,
            continuing_generation_needed: true,
            build_no_files_stall: true,
            credits_refunded: true,
            file_count: 0,
          } as Json,
        } as never)
        .eq("id", input.projectId)
        .eq("owner_id", input.userId);

      await transitionBuildJobStatus(input.writer, {
        jobId: input.buildJobId,
        ctx: workerCtx,
        toStatus: "failed",
        reason: "build_no_files_stall",
      });

      await persistAssistantBuildMessage(input.writer, eventCtx, {
        message: stallSummary,
        metadata: { continuing_generation_needed: true, build_no_files_stall: true },
      });

      await persistBuildJobEvent(input.writer, {
        ...eventCtx,
        type: "fixing_error",
        title: "Build paused — no files yet",
        detail: stallSummary,
        progressPercent: 100,
        metadata: {
          continuing_generation_needed: true,
          failed_draft: true,
          failure_kind: "build_no_files_stall",
          files_persisted: 0,
          file_count: 0,
          credits_refunded: true,
        },
      });

      await logServerOperation({
        writer: input.writer,
        userId: input.userId,
        userEmail: input.userEmail,
        stage: "build",
        event: "async_build_no_files_stall",
        status: "ok",
        mode: "build",
        modelId: pr.primaryModelId,
        projectId: input.projectId,
        buildJobId: input.buildJobId,
        operationId: input.operationId,
        metadata: { stall_ms: BUILD_NO_FILE_STALL_MS },
      });
      buildFinishedSuccess = true;
      return;
    }

    if (!buildSucceeded) {
      await clearGeneratedBuildFiles({
        writer: input.writer,
        projectId: input.projectId,
        ownerId: input.userId,
        buildJobId: input.buildJobId,
        executionInstanceId: workerCtx.executionInstanceId,
        context: "contract_failed_before_persist",
      }).catch(() => undefined);

      await refundBuildReservation({
        writer: input.writer,
        userId: input.userId,
        operationId: input.operationId,
        reservedCredits: input.reservedCredits,
        providerCostUsd: pr.totalProviderCostUsd,
        projectId: input.projectId,
        buildJobId: input.buildJobId,
      });

      const { data: cur } = await input.writer
        .from("projects")
        .select("metadata")
        .eq("id", input.projectId)
        .maybeSingle();
      const prevMeta =
        cur?.metadata && typeof cur.metadata === "object" && !Array.isArray(cur.metadata)
          ? (cur.metadata as Record<string, unknown>)
          : {};

      await input.writer
        .from("projects")
        .update({
          build_status: "needs_repair",
          metadata: {
            ...prevMeta,
            ...lifecyclePatch("needs_attention", {
              build_contract_failures: pr.buildContract.failures,
              credits_refunded: true,
            }),
            file_count: 0,
            ui_quality_score: pr.uiQualityScore,
          } as Json,
        } as never)
        .eq("id", input.projectId)
        .eq("owner_id", input.userId);

      await transitionBuildJobStatus(input.writer, {
        jobId: input.buildJobId,
        ctx: workerCtx,
        toStatus: "failed",
        reason: pr.buildContract.userMessage,
      });

      await finalizeBuildFailed({
        writer: input.writer,
        buildJobId: input.buildJobId,
        projectId: input.projectId,
        userId: input.userId,
        errorMessage: pr.buildContract.userMessage,
        skipJobStatusUpdate: true,
        failureKind: "failed_before_generation",
        memoryFileCount: 0,
        persistedFileCount: 0,
      });

      const preGenKind = failureKindForPersist({
        fileCount: 0,
        repairAttempted: false,
      });
      await persistBuildJobEvent(input.writer, {
        ...eventCtx,
        type: "failed",
        title: userSafeFailureTitle(preGenKind),
        detail: userSafeFailureDetail(preGenKind, pr.buildContract.userMessage),
        progressPercent: 100,
        metadata: {
          failures: pr.buildContract.failures,
          failure_kind: preGenKind,
          file_count: 0,
          execution_instance_id: workerCtx.executionInstanceId,
        },
      });

      await logServerOperation({
        writer: input.writer,
        userId: input.userId,
        userEmail: input.userEmail,
        stage: "build",
        event: "async_build_failed",
        status: "error",
        mode: "build",
        modelId: pr.primaryModelId,
        projectId: input.projectId,
        buildJobId: input.buildJobId,
        operationId: input.operationId,
        errorMessage: pr.errorMessage ?? pr.buildContract.userMessage,
        metadata: { failures: pr.buildContract.failures },
      });
      return;
    }

    await persistStage("persist_started", `${pr.files.length} files in memory`);
    const { result: persist } = await tracePersistGeneratedFiles({
      writer: input.writer,
      projectId: input.projectId,
      ownerId: input.userId,
      files: pr.files,
      operationId: input.operationId,
      executionInstanceId: workerCtx.executionInstanceId,
      workflowEmit: {
        writer: input.writer,
        ctx: eventCtx,
      },
    });

    await persistStage("persist_completed", `${persist.savedCount} files written`);

    const validationWatch = startValidationWatchdog({
      writer: input.writer,
      ctx: eventCtx,
      label: "Validating generated files",
    });
    const fileGate = await assertBuildFilesPersisted({
      writer: input.writer,
      projectId: input.projectId,
      archetypeId: pr.appArchetype,
    });
    validationWatch.cancel();

    const { data: projRow } = await input.writer
      .from("projects")
      .select("metadata, app_name, workspace_id")
      .eq("id", input.projectId)
      .maybeSingle();
    const projMeta =
      projRow?.metadata && typeof projRow.metadata === "object" && !Array.isArray(projRow.metadata)
        ? (projRow.metadata as Record<string, unknown>)
        : {};
    const blueprintRoutes = Array.isArray(projMeta.blueprint_routes)
      ? (projMeta.blueprint_routes as string[])
      : null;

    const tsxValidation = validateBuildTsxSources(pr.files);
    if (!tsxValidation.ok) {
      await input.writer
        .from("projects")
        .update({
          build_status: "needs_repair",
          metadata: {
            ...projMeta,
            tsx_validation_ok: false,
            tsx_validation_issues: tsxValidation.issues,
            parser_valid_primary_files: tsxValidation.validPaths,
            primary_file_bytes: tsxValidation.primaryFileBytes,
          } as never,
        } as never)
        .eq("id", input.projectId);
    }

    const prePreviewBuilt = buildProjectPreviewHtmlDetailed(pr.files, {
      projectId: input.projectId,
      archetypeId: pr.appArchetype,
    });
    const prePreviewHtml = prePreviewBuilt.html;

    const postPersist = await reconcilePostPersistBuildStatus({
      writer: input.writer,
      projectId: input.projectId,
      ownerId: input.userId,
      appName: pr.appName || (typeof projRow?.app_name === "string" ? projRow.app_name : "Your app"),
      blueprintRoutes,
      priorFailures: allContractFailures,
      operationId: input.operationId,
      executionInstanceId: workerCtx.executionInstanceId,
      userPrompt: input.userPrompt,
      archetypeId: pr.appArchetype,
      previewHtmlLength: prePreviewHtml.length,
      previewHtmlSnippet: prePreviewHtml.slice(0, 2000),
    });

    const integrityMeta = {
      source_integrity_ok: postPersist.sourceIntegrity.sourceIntegrityOk,
      meaningful_source_file_count: postPersist.sourceIntegrity.meaningfulSourceFileCount,
      code_tab_readable_count: postPersist.sourceIntegrity.codeTabReadableCount,
      preview_renderable: postPersist.sourceIntegrity.previewRenderable,
      ready_reason: postPersist.sourceIntegrity.readyReason,
      blocked_reason: postPersist.sourceIntegrity.blockedReason,
      preview_renderer_source: prePreviewBuilt.meta.preview_renderer_source,
      preview_primary_file: prePreviewBuilt.meta.preview_primary_file,
      preview_html_snippet: prePreviewHtml.slice(0, 2000),
      tsx_validation_ok: tsxValidation.ok,
      tsx_validation_issues: tsxValidation.issues,
      parser_valid_primary_files: tsxValidation.validPaths,
      primary_file_bytes: tsxValidation.primaryFileBytes,
    };

    if (postPersist.technicalGenerationIncomplete || !postPersist.sourceIntegrity.sourceIntegrityOk) {
      await input.writer
        .from("projects")
        .update({
          build_status: "needs_repair",
          metadata: {
            ...projMeta,
            ...integrityMeta,
            file_count: postPersist.visibleFileCount,
            credits_refunded: false,
          } as Json,
        } as never)
        .eq("id", input.projectId)
        .eq("owner_id", input.userId);

      await transitionBuildJobStatus(input.writer, {
        jobId: input.buildJobId,
        ctx: workerCtx,
        toStatus: "failed",
        reason: postPersist.sourceIntegrity.blockedReason ?? "technical_generation_incomplete",
      });

      await persistBuildJobEvent(input.writer, {
        ...eventCtx,
        type: "fixing_error",
        title: "Build needs attention",
        detail: postPersist.sourceIntegrity.blockedReason?.includes("missing_root_page_content")
          ? "The main page is incomplete. Run repair to regenerate it."
          : "File paths exist, but source content is missing or too thin to render.",
        progressPercent: 100,
        metadata: {
          failure_kind: "failed_after_generation",
          file_count: postPersist.visibleFileCount,
          files_persisted: postPersist.visibleFileCount,
          ...integrityMeta,
          credits_refunded: false,
        },
      });

      if (!alreadyCharged) {
        await chargeStagedBuildIfNeeded({
          writer: input.writer,
          userId: input.userId,
          operationId: input.operationId,
          projectId: input.projectId,
          reservedCredits: input.reservedCredits,
          chargeCalc: calculateCreditsForStagedBuild({
            providerCostUsd: pr.totalProviderCostUsd,
            complexity: pr.complexity,
            inputTokens: pr.totalInputTokens,
            outputTokens: pr.totalOutputTokens,
            primaryModelId: pr.primaryModelId,
            fileCount: postPersist.visibleFileCount,
          }),
          complexity: pr.complexity,
        });
      }

      await logServerOperation({
        writer: input.writer,
        userId: input.userId,
        userEmail: input.userEmail,
        stage: "build",
        event: "technical_generation_incomplete",
        status: "error",
        mode: "build",
        modelId: pr.primaryModelId,
        projectId: input.projectId,
        buildJobId: input.buildJobId,
        operationId: input.operationId,
        metadata: integrityMeta,
      });
      buildFinishedSuccess = true;
      return;
    }

    await persistStage(
      "source_integrity_passed",
      `${postPersist.visibleFileCount} files saved — source integrity passed`,
    );
    await persistBuildJobEvent(input.writer, {
      ...eventCtx,
      type: "saving_files",
      title: "Files saved",
      detail: `${postPersist.visibleFileCount} files verified`,
      progressPercent: 88,
      metadata: {
        source_integrity_ok: true,
        file_count: postPersist.visibleFileCount,
        files_persisted: postPersist.visibleFileCount,
        files_persist_confirmed: true,
      },
    });

    await input.writer
      .from("projects")
      .update({
        metadata: {
          ...projMeta,
          files_persist_confirmed: true,
          source_integrity_ok: true,
          file_count: postPersist.visibleFileCount,
        } as Json,
      } as never)
      .eq("id", input.projectId)
      .eq("owner_id", input.userId);

    if (postPersist.persistenceFailure) {
      const failDetail = "technical_persistence_failure:files_without_readable_content";
      await transitionBuildJobStatus(input.writer, {
        jobId: input.buildJobId,
        ctx: workerCtx,
        toStatus: "failed",
        reason: failDetail,
      });
      await finalizeBuildFailed({
        writer: input.writer,
        buildJobId: input.buildJobId,
        projectId: input.projectId,
        userId: input.userId,
        errorMessage: "Files were created but content could not be read. Try repair in chat.",
        skipJobStatusUpdate: true,
        persistedFileCount: postPersist.visibleFileCount,
        memoryFileCount: pr.files.length,
        failureKind: "failed_after_generation",
      });
      await persistBuildJobEvent(input.writer, {
        ...eventCtx,
        type: "failed",
        title: "Build needs attention",
        detail:
          "File paths were saved but readable content is missing. Use Fix in chat to repair persistence.",
        progressPercent: 100,
        metadata: { failure_kind: "failed_after_generation", file_count: postPersist.visibleFileCount },
      });
      return;
    }

    let persistResult = persist;
    let fileGateResult = fileGate;
    let persistHardFail =
      !persistResult.persistOk || persistResult.savedCount < MIN_RENDERABLE_FILES;

    if (persistHardFail && pr.files.length >= MIN_RENDERABLE_FILES) {
      const { result: retryPersist } = await tracePersistGeneratedFiles({
        writer: input.writer,
        projectId: input.projectId,
        ownerId: input.userId,
        files: pr.files,
        operationId: input.operationId,
        executionInstanceId: workerCtx.executionInstanceId,
        workflowEmit: {
          writer: input.writer,
          ctx: eventCtx,
        },
      });
      if (retryPersist.persistOk && retryPersist.savedCount >= MIN_RENDERABLE_FILES) {
        persistResult = retryPersist;
        persistHardFail = false;
        fileGateResult = await assertBuildFilesPersisted({
          writer: input.writer,
          projectId: input.projectId,
          archetypeId: pr.appArchetype,
        });
      }
    }

    let gateBlocksCompletion =
      !fileGateResult.ok &&
      !canCompleteWithSavedFiles(fileGateResult.fileCount, fileGateResult.failures);

    if (
      gateBlocksCompletion &&
      (persistResult.savedCount >= MIN_RENDERABLE_FILES || pr.files.length >= MIN_RENDERABLE_FILES)
    ) {
      const relaxedGate = await assertBuildFilesPersisted({
        writer: input.writer,
        projectId: input.projectId,
        archetypeId: pr.appArchetype,
        minComponents: 1,
        minFiles: MIN_RENDERABLE_FILES,
      });
      if (relaxedGate.ok || canCompleteWithSavedFiles(relaxedGate.fileCount, relaxedGate.failures)) {
        fileGateResult = relaxedGate;
        gateBlocksCompletion = false;
      }
    }

    const canProceedToPreview =
      !persistHardFail &&
      (fileGateResult.ok ||
        canCompleteWithSavedFiles(fileGateResult.fileCount, fileGateResult.failures));

    if (!canProceedToPreview) {
      const savedCount = Math.max(persistResult.savedCount, fileGateResult.fileCount, pr.files.length);
      const terminalTruth = resolveBuildTerminalTruth({
        memoryFileCount: pr.files.length,
        persistedFileCount: persistResult.savedCount,
        failureKind: "failed_before_generation",
        sourceIntegrityOk: false,
        creditsRefunded: true,
      });

      if (process.env.NODE_ENV !== "production") {
        console.warn("[execute-staged-build] files_persistence_failed", {
          projectId: input.projectId,
          persistOk: persistResult.persistOk,
          savedCount: persistResult.savedCount,
          persistError: persistResult.error,
          fileGateFailures: fileGateResult.failures,
          persistHardFail,
          gateBlocksCompletion,
          terminalState: terminalTruth.state,
        });
      }

      if (!terminalTruth.hasRecoverableFiles) {
        await clearGeneratedBuildFiles({
          writer: input.writer,
          projectId: input.projectId,
          ownerId: input.userId,
          buildJobId: input.buildJobId,
          executionInstanceId: workerCtx.executionInstanceId,
          context: "contract_failed_before_persist",
        }).catch(() => undefined);
      }

      await refundBuildReservation({
        writer: input.writer,
        userId: input.userId,
        operationId: input.operationId,
        reservedCredits: input.reservedCredits,
        providerCostUsd: pr.totalProviderCostUsd,
        projectId: input.projectId,
        buildJobId: input.buildJobId,
      });

      const failDetail =
        fileGateResult.failures.join("; ") ||
        persistResult.error ||
        "files_persistence_failed";

      await transitionBuildJobStatus(input.writer, {
        jobId: input.buildJobId,
        ctx: workerCtx,
        toStatus: "failed",
        reason: failDetail,
      });

      await finalizeBuildFailed({
        writer: input.writer,
        buildJobId: input.buildJobId,
        projectId: input.projectId,
        userId: input.userId,
        errorMessage: terminalTruth.headline,
        skipJobStatusUpdate: true,
        memoryFileCount: pr.files.length,
        persistedFileCount: persistResult.savedCount,
        failureKind: truthFailureKindForPersist(terminalTruth),
      });

      const truthKind = truthFailureKindForPersist(terminalTruth);
      await persistBuildJobEvent(input.writer, {
        ...eventCtx,
        type: terminalTruth.hasRecoverableFiles ? "fixing_error" : "failed",
        title: terminalTruth.headline,
        detail: terminalTruth.bodyLines.join(" "),
        progressPercent: 100,
        metadata: {
          failures: fileGateResult.failures,
          persist_error: persistResult.error,
          failure_kind: truthKind,
          file_count: savedCount,
          files_persisted: persistResult.savedCount,
          memory_file_count: pr.files.length,
          show_retry_save: terminalTruth.showRetrySave,
        },
      });
      return;
    }

    const meaningfulQuality =
      "meaningfulQualityReport" in pr ? pr.meaningfulQualityReport : undefined;
    const buildFinalSummary =
      "buildFinalSummary" in pr && typeof pr.buildFinalSummary === "string"
        ? pr.buildFinalSummary
        : null;
    if (genericScaffold.isGeneric) {
      await persistAssistantBuildMessage(input.writer, eventCtx, {
        message:
          buildFinalSummary ??
          "Build blocked — generic scaffold detected. Full model generation is required before preview.",
        metadata: { generic_scaffold: true, confidence: genericScaffold.confidence },
      });
      await transitionBuildJobStatus(input.writer, {
        jobId: input.buildJobId,
        ctx: workerCtx,
        toStatus: "failed",
        reason: "generic_scaffold_detected",
      });
      buildFinishedSuccess = true;
      return;
    }
    if (
      isProductionBuildMode() &&
      meaningfulQuality &&
      !meaningfulQuality.passes
    ) {
      await persistAssistantBuildMessage(input.writer, eventCtx, {
        message:
          buildFinalSummary ??
          (completionGate.userMessage ||
            "Continuing app completion — finishing remaining screens."),
        metadata: {
          continuing_generation_needed: qualitySoftBlock || completionGate.shouldContinue,
        },
      });
    } else if (meaningfulQuality && !meaningfulQuality.passes) {
      await persistAssistantBuildMessage(input.writer, eventCtx, {
        message: "Continuing app completion — finishing remaining screens.",
        metadata: {
          continuing_generation_needed: true,
        },
      });
    }

    await persistStage("preview_started");
    await emitPreviewWorkflowEvent(input.writer, eventCtx, {
      phase: "started",
      message: "Starting preview render",
      progressPercent: 92,
    });
    let previewResult = await startPreviewSession({
      writer: input.writer,
      userId: input.userId,
      projectId: input.projectId,
    });

    let workingFiles = postPersist.files;
    let postPreviewBuilt = buildProjectPreviewHtmlDetailed(workingFiles, {
      projectId: input.projectId,
      archetypeId: pr.appArchetype,
    });
    let postPreviewHtml = postPreviewBuilt.html;

    let postPreview = await reconcilePostPersistBuildStatus({
      writer: input.writer,
      projectId: input.projectId,
      ownerId: input.userId,
      appName: pr.appName || (typeof projRow?.app_name === "string" ? projRow.app_name : "Your app"),
      blueprintRoutes,
      priorFailures: allContractFailures,
      operationId: input.operationId,
      executionInstanceId: workerCtx.executionInstanceId,
      userPrompt: input.userPrompt,
      archetypeId: pr.appArchetype,
      previewSessionOk: previewResult.ok,
      previewHtmlLength: postPreviewHtml.length,
      previewHtmlSnippet: postPreviewHtml.slice(0, 2000),
    });

    const staticPreviewOk = isStaticPreviewSnapshotHealthy(
      postPreviewHtml,
      workingFiles.length,
    );
    let previewStillFailed = isPreviewGateFailed(
      postPreviewHtml,
      workingFiles,
      previewResult.ok || staticPreviewOk,
    );
    if (previewStillFailed) {
      const htmlDiag = analyzePreviewHtml(postPreviewHtml, workingFiles, {
        previewSessionOk: previewResult.ok || staticPreviewOk,
      });
      const rawCode = !previewResult.ok
        ? previewResult.code
        : htmlDiag.errorCode ?? postPreview.sourceIntegrity.blockedReason;
      const classified = classifyPreviewFailure({
        html: postPreviewHtml,
        htmlLength: postPreviewHtml.length,
        hasRootElement: htmlDiag.hasRootElement,
        missingImports: postPreview.sourceIntegrity.blockedReason?.includes("import")
          ? [postPreview.sourceIntegrity.blockedReason]
          : [],
        sourceIntegrityOk: postPreview.sourceIntegrity.sourceIntegrityOk,
        blockedReason: postPreview.sourceIntegrity.blockedReason,
        timedOut: rawCode === "preview_timeout",
      });
      let previewCode: PreviewFailureCode = isPreviewFailureCode(rawCode ?? "")
        ? (rawCode as PreviewFailureCode)
        : classified.code;
      let previewErr = classified.userMessage;

      if (isPreviewRepairEligible(previewCode)) {
        await emitRepairWorkflowEvent(input.writer, eventCtx, {
          phase: "started",
          message: "Running deterministic preview repair",
          progressPercent: 94,
        });
        const repair = runDeterministicPreviewRepair({
          files: workingFiles,
          failureCode: previewCode,
          appName: pr.appName,
          archetypeId: pr.appArchetype,
        });
        if (repair.applied) {
          await persistGeneratedBuildFiles({
            writer: input.writer,
            projectId: input.projectId,
            ownerId: input.userId,
            files: repair.files,
            executionInstanceId: workerCtx.executionInstanceId,
          });
          workingFiles = repair.files;
          postPreviewBuilt = buildProjectPreviewHtmlDetailed(workingFiles, {
            projectId: input.projectId,
            archetypeId: pr.appArchetype,
          });
          postPreviewHtml = postPreviewBuilt.html;
          previewResult = await startPreviewSession({
            writer: input.writer,
            userId: input.userId,
            projectId: input.projectId,
          });
          postPreview = await reconcilePostPersistBuildStatus({
            writer: input.writer,
            projectId: input.projectId,
            ownerId: input.userId,
            appName: pr.appName || (typeof projRow?.app_name === "string" ? projRow.app_name : "Your app"),
            blueprintRoutes,
            priorFailures: allContractFailures,
            operationId: input.operationId,
            executionInstanceId: workerCtx.executionInstanceId,
            userPrompt: input.userPrompt,
            archetypeId: pr.appArchetype,
            previewSessionOk: previewResult.ok,
            previewHtmlLength: postPreviewHtml.length,
            previewHtmlSnippet: postPreviewHtml.slice(0, 2000),
          });
          previewStillFailed = isPreviewGateFailed(
            postPreviewHtml,
            workingFiles,
            previewResult.ok || staticPreviewOk,
          );
          if (!previewStillFailed) {
            await emitRepairWorkflowEvent(input.writer, eventCtx, {
              phase: "completed",
              message: "Repair succeeded — preview render retried",
              progressPercent: 97,
            });
            await emitPreviewWorkflowEvent(input.writer, eventCtx, {
              phase: "rendered",
              message: "Preview rendered successfully",
              progressPercent: 98,
            });
          }
        }
        await emitRepairWorkflowEvent(input.writer, eventCtx, {
          phase: "completed",
          message: repair.applied ? "Repair pass finished" : "Repair not applicable",
          progressPercent: 95,
        });
      }

      if (previewStillFailed) {
      const filesKept = Math.max(fileGate.fileCount, postPreview.visibleFileCount);
      const previewDiag = await loadLatestPreviewDiagnostics(
        createSupabaseAdmin(),
        input.projectId,
      );
      const previewBuildLogs = previewDiag?.buildLogs ?? null;
      const previewClassification = classifyPreviewBuildFailure({
        appFilesCount: filesKept,
        routesCount: countAppRoutes(workingFiles),
        packageJsonExists: workingFiles.some((f) => f.path === "package.json"),
        entrypointExists: workingFiles.some((f) => /^app\/(page|layout)\.(tsx|jsx)$/i.test(f.path)),
        previewArtifactExists: Boolean(previewResult.ok && previewResult.sessionId),
        buildLogs: previewBuildLogs,
        errorCode: previewCode,
        blockedReason: postPreview.sourceIntegrity.blockedReason,
        userMessage: !previewResult.ok ? previewResult.error : previewErr,
        jobStatus: previewResult.ok ? "succeeded" : "failed",
        previewStatus: previewResult.ok ? "ready" : "failed",
        previewBuildJobId: previewDiag?.jobId ?? null,
        sourceIntegrityOk: postPreview.sourceIntegrity.sourceIntegrityOk,
        meaningfulSourceFileCount: postPreview.sourceIntegrity.meaningfulSourceFileCount,
      });
      previewErr = previewClassification.human_summary;
      previewCode = isPreviewFailureCode(previewCode)
        ? previewCode
        : previewClassification.failure_kind === "missing_import"
          ? "invalid_import"
          : previewClassification.failure_kind === "typescript_compile_failed"
            ? "compile_error"
            : previewCode;

      await persistLatestPreviewFailure({
        writer: input.writer,
        projectId: input.projectId,
        ownerId: input.userId,
        buildJobId: input.buildJobId,
        previewSessionId: "sessionId" in previewResult ? previewResult.sessionId : undefined,
        record: buildLatestPreviewFailureRecord({
          classification: previewClassification,
          previewSessionId: "sessionId" in previewResult ? previewResult.sessionId : null,
          previewBuildJobId: previewDiag?.jobId ?? null,
          appFilesCount: filesKept,
          routesCount: countAppRoutes(workingFiles),
          packageJsonExists: workingFiles.some((f) => f.path === "package.json"),
          entrypointExists: workingFiles.some((f) => /^app\/(page|layout)\.(tsx|jsx)$/i.test(f.path)),
          previewArtifactExists: false,
          generationQualityScore:
            ("generationQualityReport" in pr ? pr.generationQualityReport?.score : undefined) ??
            pr.uiQualityScore,
          sourceIntegrityScore: postPreview.sourceIntegrity.meaningfulSourceFileCount,
        }),
      });

      const { data: cur } = await input.writer
        .from("projects")
        .select("metadata")
        .eq("id", input.projectId)
        .maybeSingle();
      const prevMeta =
        cur?.metadata && typeof cur.metadata === "object" && !Array.isArray(cur.metadata)
          ? (cur.metadata as Record<string, unknown>)
          : {};

      await input.writer
        .from("projects")
        .update({
          build_status: "preview_failed",
          metadata: {
            ...prevMeta,
            ...lifecyclePatch("needs_attention", {
              files_ready: true,
              files_ready_preview_failed: true,
              preview_error: previewErr,
              preview_error_code: previewCode,
              file_count: filesKept,
              credits_refunded: false,
            }),
            file_count: filesKept,
            ui_quality_score: pr.uiQualityScore,
            generation_quality_score:
              ("generationQualityReport" in pr ? pr.generationQualityReport?.score : undefined) ??
              pr.uiQualityScore,
            source_integrity_score: postPreview.sourceIntegrity.meaningfulSourceFileCount,
            preview_build_status: "failed",
          } as Json,
        } as never)
        .eq("id", input.projectId)
        .eq("owner_id", input.userId);

      await transitionBuildJobStatus(input.writer, {
        jobId: input.buildJobId,
        ctx: workerCtx,
        toStatus: "failed",
        reason: previewErr,
      });

      await emitPreviewWorkflowEvent(input.writer, eventCtx, {
        phase: "failed",
        message: previewErr,
        failureCode: previewCode,
        progressPercent: 100,
        metadata: {
          preview_failed: true,
          files_kept: filesKept,
          failure_kind: previewClassification.failure_kind,
          preview_failure_code: previewCode,
          preview_failure_stage: previewClassification.failure_stage,
          source_integrity_ok: postPreview.sourceIntegrity.sourceIntegrityOk,
          preview_renderable: postPreview.sourceIntegrity.previewRenderable,
          blocked_reason: postPreview.sourceIntegrity.blockedReason,
          execution_instance_id: workerCtx.executionInstanceId,
          credits_refunded: false,
        },
      });

      if (!alreadyCharged) {
        const previewFailCharged = await chargeStagedBuildIfNeeded({
          writer: input.writer,
          userId: input.userId,
          operationId: input.operationId,
          projectId: input.projectId,
          reservedCredits: input.reservedCredits,
          chargeCalc: calculateCreditsForStagedBuild({
            providerCostUsd: pr.totalProviderCostUsd,
            complexity: pr.complexity,
            inputTokens: pr.totalInputTokens,
            outputTokens: pr.totalOutputTokens,
            primaryModelId: pr.primaryModelId,
            fileCount: filesKept,
          }),
          complexity: pr.complexity,
        });
        if (previewFailCharged > 0) {
          await persistBuildJobEvent(input.writer, {
            ...eventCtx,
            type: "completed",
            title: "Build saved — preview needs repair",
            detail: `${filesKept} files saved`,
            progressPercent: 100,
            metadata: { credits_charged: previewFailCharged, files_persisted: filesKept },
          });
        }
      }

      await logServerOperation({
        writer: input.writer,
        userId: input.userId,
        userEmail: input.userEmail,
        stage: "build",
        event: "preview_failed_files_kept",
        status: "error",
        mode: "build",
        modelId: pr.primaryModelId,
        projectId: input.projectId,
        buildJobId: input.buildJobId,
        operationId: input.operationId,
        errorMessage: previewErr,
        metadata: { code: previewCode, files_kept: filesKept },
      });
      return;
      }
    }

    const iconApiUrl =
      pr.iconUrl ?? `${getAppUrl().replace(/\/$/, "")}/api/projects/${input.projectId}/icon`;

    await input.writer
      .from("projects")
      .update({
        app_icon_url: pr.iconSvg,
        icon_url: pr.iconUrl ?? iconApiUrl,
        app_name: pr.appName.slice(0, 80),
      } as never)
      .eq("id", input.projectId)
      .eq("owner_id", input.userId);

    const resolvedPreviewUrl = previewResult.ok ? previewResult.previewUrl : null;
    await persistStage("preview_completed", resolvedPreviewUrl ?? "ready");

    await transitionBuildJobStatus(input.writer, {
      jobId: input.buildJobId,
      ctx: workerCtx,
      toStatus: "completed",
      reason: "preview_ready",
    });

    await finalizeBuildSuccess({
      writer: input.writer,
      userId: input.userId,
      projectId: input.projectId,
      buildJobId: input.buildJobId,
      appName: pr.appName,
      appSlug: pr.meta?.app?.slug ?? null,
      appDescription: pr.meta?.app?.description ?? null,
      iconSvg: pr.iconSvg,
      meta: pr.meta,
      fileCount: fileGate.fileCount,
      creditsCharged: 0,
      charged: false,
      skipJobStatusUpdate: true,
    });

    let creditsCharged = 0;
    if (!alreadyCharged) {
      creditsCharged = await chargeStagedBuildIfNeeded({
        writer: input.writer,
        userId: input.userId,
        operationId: input.operationId,
        projectId: input.projectId,
        reservedCredits: input.reservedCredits,
        chargeCalc: calculateCreditsForStagedBuild({
          providerCostUsd: pr.totalProviderCostUsd,
          complexity: pr.complexity,
          inputTokens: pr.totalInputTokens,
          outputTokens: pr.totalOutputTokens,
          primaryModelId: pr.primaryModelId,
          fileCount: fileGate.fileCount,
        }),
        complexity: pr.complexity,
      });

      if (creditsCharged > 0) {
        await finalizeBuildSuccess({
          writer: input.writer,
          userId: input.userId,
          projectId: input.projectId,
          buildJobId: input.buildJobId,
          appName: pr.appName,
          appSlug: pr.meta?.app?.slug ?? null,
          appDescription: pr.meta?.app?.description ?? null,
          iconSvg: pr.iconSvg,
          meta: pr.meta,
          fileCount: fileGate.fileCount,
          creditsCharged,
          charged: true,
          skipJobStatusUpdate: true,
        });
      }
    }

    const previewLive = isStaticPreviewSnapshotHealthy(
      postPreviewHtml,
      workingFiles.length,
    );

    if (qualitySoftBlock || completionGate.shouldContinue) {
      const { data: curDraft } = await input.writer
        .from("projects")
        .select("metadata, preview_url")
        .eq("id", input.projectId)
        .maybeSingle();
      const draftMeta =
        curDraft?.metadata && typeof curDraft.metadata === "object" && !Array.isArray(curDraft.metadata)
          ? (curDraft.metadata as Record<string, unknown>)
          : {};
      await input.writer
        .from("projects")
        .update({
          build_status: previewLive ? "completed" : "needs_repair",
          metadata: {
            ...draftMeta,
            continuing_generation_needed: true,
            completion_gate: completionGate.shouldContinue ? completionGate.domain : undefined,
            preview_blocked: false,
            partial_draft_preview: true,
            preview_renderable: previewLive,
            preview_ready: previewLive,
            preview_honest: previewLive,
            file_count: fileGate.fileCount,
          } as Json,
        } as never)
        .eq("id", input.projectId)
        .eq("owner_id", input.userId);
    }

    const completionBlocked = completionGate.shouldContinue;

    const generationQualityReport =
      "generationQualityReport" in pr ? pr.generationQualityReport : undefined;
    const generationQualityPasses = generationQualityReport?.passes ?? false;
    const generationScore = generationQualityReport?.score ?? pr.uiQualityScore;
    const richnessOk = pr.uiRichnessPasses && pr.uiQualityScore >= 85;
    const canShowDone =
      !completionBlocked &&
      previewLive &&
      richnessOk &&
      pr.buildContract.previewReady &&
      generationQualityPasses;
    const routeVerified = generationQualityReport?.routeConnectivity;
    const doneSummary =
      buildFinalSummary ??
      (canShowDone
        ? pr.meta?.summary?.trim() ||
          `Build complete — ${pr.appName} (${fileGate.fileCount} files).`
        : completionBlocked
          ? completionGate.userMessage || "Continuing app completion…"
          : qualitySoftBlock && previewLive
            ? `Early preview is live — ${fileGate.fileCount} files saved. Continue generation to finish remaining screens.`
            : generationQualityReport?.needsContinuation
              ? `Build needs another generation pass — ${fileGate.fileCount} files saved so far.`
              : richnessOk
                ? `Build saved — continue generation to finish remaining screens (${fileGate.fileCount} files).`
                : `Build paused — continue generation to finish the app (${fileGate.fileCount} files so far).`);
    await persistAssistantBuildMessage(input.writer, eventCtx, {
      message: doneSummary.slice(0, 280),
      progressPercent: 98,
    });
    await persistBuildJobEvent(input.writer, {
      ...eventCtx,
      type: "completed",
      title: canShowDone
        ? "Build complete"
        : completionBlocked
          ? "Continuing app completion"
          : qualitySoftBlock && previewLive
            ? "Early preview ready"
            : generationQualityReport?.needsContinuation
              ? "Continuing generation needed"
              : richnessOk
                ? "Build saved — quality repair needed"
                : "Draft saved",
      detail: canShowDone
        ? routeVerified
          ? `Preview live · routes ${routeVerified.verifiedCount}/${routeVerified.totalCount}`
          : "Preview is live with rich dashboard UI."
        : completionBlocked
          ? completionGate.userMessage || "Finishing screens, navigation, and data."
          : qualitySoftBlock && previewLive
            ? `${fileGate.fileCount} files saved — preview is live while generation continues.`
            : generationQualityReport?.needsContinuation
              ? "More pages are needed before this app is complete."
              : richnessOk
                ? "Continue generation to finish remaining screens before preview."
                : "Build needs another generation pass before preview.",
      progressPercent: 100,
      metadata: {
        credits_charged: creditsCharged,
        preview_url: resolvedPreviewUrl,
        files_persisted: fileGate.fileCount,
        stream_category: "completed",
        source_integrity_ok: postPreview.sourceIntegrity.sourceIntegrityOk,
        preview_renderable: previewLive,
        ui_richness_passes: richnessOk,
        continuing_generation_needed: completionBlocked || qualitySoftBlock,
        ready_reason: previewLive ? "source_integrity_ok_preview_live" : "preview_pending",
      },
    });

    if (fileGate.fileCount > 0) {
      const versionMode = completionBlocked
        ? "build_continuing"
        : canShowDone
          ? "build_completed"
          : qualitySoftBlock
            ? "build_paused"
            : "build_completed";
      const versionStatus = completionBlocked || qualitySoftBlock ? "paused_partial" : "completed";
      await saveAppVersionSnapshot({
        admin: input.writer,
        projectId: input.projectId,
        ownerId: input.userId,
        workspaceId:
          typeof projRow?.workspace_id === "string" ? projRow.workspace_id : null,
        createdBy: input.userId,
        mode: versionMode,
        summary: (input.userPrompt ?? "").slice(0, 120) || `${fileGate.fileCount} files`,
        files: workingFiles,
        changedPaths: pr.files.map((f) => f.path).slice(0, 200),
      }).catch(() => null);

      const { data: curForLive } = await input.writer
        .from("projects")
        .select("metadata")
        .eq("id", input.projectId)
        .maybeSingle();
      const liveMeta =
        curForLive?.metadata && typeof curForLive.metadata === "object" && !Array.isArray(curForLive.metadata)
          ? (curForLive.metadata as Record<string, unknown>)
          : {};
      await input.writer
        .from("projects")
        .update({
          metadata: {
            ...liveMeta,
            live_version_status: versionStatus,
            last_build_model: pr.primaryModelId,
            last_build_prompt: input.userPrompt?.slice(0, 500) ?? null,
          } as Json,
        } as never)
        .eq("id", input.projectId)
        .eq("owner_id", input.userId);
    }

    await logServerOperation({
      writer: input.writer,
      userId: input.userId,
      userEmail: input.userEmail,
      stage: "build",
      event: "async_build_success",
      status: "ok",
      mode: "build",
      modelId: pr.primaryModelId,
      projectId: input.projectId,
      buildJobId: input.buildJobId,
      operationId: input.operationId,
      metadata: {
        files: fileGate.fileCount,
        credits_charged: creditsCharged,
        preview_url: resolvedPreviewUrl,
      },
    });
    await persistStage("job_completed");
    buildFinishedSuccess = true;
  } catch (err) {
    await writeWorkerStallSnapshot({
      buildJobId: input.buildJobId,
      projectId: input.projectId,
      operationId: input.operationId,
      trace: getBuildWorkerTrace(input.buildJobId),
    }).catch(() => undefined);
    const normalized = normalizeBuildError(err, {
      stage: "build_pipeline",
      operationId: input.operationId,
      projectId: input.projectId,
      mode: "build",
      modelId: input.modelId,
    });

    await persistStage("job_failed", normalized.userMessage).catch(() => undefined);

    if (!jobClaimed) return;

    await refundBuildReservation({
      writer: input.writer,
      userId: input.userId,
      operationId: input.operationId,
      reservedCredits: input.reservedCredits,
      providerCostUsd: 0,
      projectId: input.projectId,
      buildJobId: input.buildJobId,
    }).catch(() => undefined);

    await transitionBuildJobStatus(input.writer, {
      jobId: input.buildJobId,
      ctx: workerCtx,
      toStatus: "failed",
      reason: normalized.userMessage,
    }).catch(() => undefined);

    await finalizeBuildFailed({
      writer: input.writer,
      buildJobId: input.buildJobId,
      projectId: input.projectId,
      userId: input.userId,
      errorMessage: normalized.userMessage,
      skipJobStatusUpdate: true,
    }).catch(() => undefined);

    await persistBuildJobEvent(input.writer, {
      ...eventCtx,
      type: "failed",
      title: "Build failed",
      detail: normalized.userMessage,
      progressPercent: 100,
      metadata: {
        code: normalized.code,
        retryable: normalized.retryable,
        execution_instance_id: workerCtx.executionInstanceId,
      },
    });

    await logServerOperation({
      writer: input.writer,
      userId: input.userId,
      userEmail: input.userEmail,
      stage: "build",
      event: "async_build_crash",
      status: "error",
      mode: "build",
      modelId: input.modelId,
      projectId: input.projectId,
      buildJobId: input.buildJobId,
      operationId: input.operationId,
      errorMessage: normalized.message,
      metadata: { code: normalized.code, stage: normalized.stage },
    });
  } finally {
    clearInterval(heartbeat);
    setTraceHeartbeatRunning(trace, false);
    clearBuildWorkerTrace(input.buildJobId);
    inFlightBuildJobs.delete(input.buildJobId);
  }
}
