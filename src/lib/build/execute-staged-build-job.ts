import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { runStagedBuildPipeline } from "@/lib/build/build-pipeline";
import { calculateCreditsForStagedBuild } from "@/lib/credits/credit-pricing";
import { reconcileGenerationReservation } from "@/lib/billing/credit-reservations";
import { assertProfitableCharge } from "@/lib/billing/credit-profit-guard";
import { finalizeBuildSuccess, finalizeBuildFailed } from "@/lib/build/finalize-build";
import { finalizeBuildPartial } from "@/lib/build/finalize-build-partial";
import {
  userFacingPartialStopMessage,
  workflowEventCreditStageCost,
} from "@/lib/billing/partial-build-credits";
import { filterRenderableBuildFiles } from "@/lib/build/generated-file-utils";
import { getAppUrl } from "@/lib/app-url";
import { hasSuccessfulChargeForOperation } from "@/lib/chat/server-idempotency";
import { clearGeneratedBuildFiles } from "@/lib/build/persist-generated-files";
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
import { persistGeneratedBuildFiles } from "@/lib/build/persist-generated-files";
import {
  analyzePreviewHtml,
  isStaticPreviewSnapshotHealthy,
} from "@/lib/preview/preview-html-diagnostics";
import { startValidationWatchdog } from "@/lib/build/validation-watchdog";

type Writer = SupabaseClient<Database>;

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
};

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
  const progressForStep = () => undefined;
  let lastActivityAt = Date.now();
  let currentStepLabel = "Creating the app plan";
  let lastHeartbeatPersist = 0;

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
    if (Date.now() - lastActivityAt < 5000) return;
    const snap = getBuildWorkerTrace(input.buildJobId);
    const stageLabel = snap?.lastStage ?? "working";
    if (Date.now() - lastHeartbeatPersist < 5000) return;
    lastHeartbeatPersist = Date.now();
    void persistBuildJobEvent(input.writer, {
      ...eventCtx,
      type: "understanding_request",
      title: "Still working",
      detail: `Still working on ${currentStepLabel}…`,
      progressPercent: undefined,
      metadata: {
        trace_stage: stageLabel,
        heartbeat: true,
        operation_id: input.operationId,
        execution_instance_id: workerCtx.executionInstanceId,
      },
    }).catch(() => {});
  }, 8000);

  const PIPELINE_HARD_CAP_MS = 5 * 60 * 1000;

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
    await persistAssistantBuildMessage(input.writer, eventCtx, {
      message: "I'll map your app structure and start generating files.",
      progressPercent: 10,
    }).catch(() => undefined);

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
      onWorkflowEvent: async (ev) => {
        lastActivityAt = Date.now();
        currentStepLabel = ev.label;
        if (input.partialCreditBuild && Number.isFinite(creditTracker.budget)) {
          creditTracker.used += workflowEventCreditStageCost(ev.type);
          if (creditTracker.used >= creditTracker.budget) {
            creditTracker.stop = true;
          }
        }
        await persistWorkflowEvent(input.writer, eventCtx, ev, progressForStep());
      },
    });

    const creditTracker = {
      used: 0,
      budget: input.partialCreditBuild ? Math.max(1, input.reservedCredits ?? 0) : Infinity,
      stop: false,
    };

    const pr = await Promise.race([
      pipelinePromise,
      new Promise<Awaited<typeof pipelinePromise>>((_, reject) => {
        setTimeout(
          () => reject(new Error("build_pipeline_hard_cap_exceeded")),
          PIPELINE_HARD_CAP_MS,
        );
      }),
    ]).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("hard_cap")) {
        return {
          ok: false,
          visibleText: "Build timed out — try again or use a shorter prompt.",
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
    const allContractFailures = [
      ...new Set([...pr.buildContract.failures, ...(pr.postBuildFailures ?? [])]),
    ];
    let buildSucceeded =
      (pr.ok && pr.buildContract.passed) ||
      canCompleteWithSavedFiles(saveableFileCount, allContractFailures);

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

      await persistStage("persist_completed", `${persist.savedCount} files saved`);

      if (!alreadyCharged && input.reservedCredits && input.reservedCredits > 0) {
        const chargeCalc = calculateCreditsForStagedBuild({
          providerCostUsd: pr.totalProviderCostUsd,
          complexity: pr.complexity,
          inputTokens: pr.totalInputTokens,
          outputTokens: pr.totalOutputTokens,
          primaryModelId: pr.primaryModelId,
          fileCount: Math.max(persist.savedCount, saveableFileCount),
        });
        const profitable = assertProfitableCharge(
          chargeCalc.creditsToCharge,
          chargeCalc.estimatedProviderCostUsd,
        );
        if (profitable.ok) {
          await reconcileGenerationReservation(input.writer, {
            userId: input.userId,
            generationId: input.operationId,
            reservedCredits: input.reservedCredits,
            actualUserCredits: Math.min(input.reservedCredits, chargeCalc.creditsToCharge),
            providerCostUsd: chargeCalc.estimatedProviderCostUsd,
            success: true,
            projectId: input.projectId,
          });
        }
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

    await persistStage("persist_completed", `${persist.savedCount} files saved`);
    await persistBuildJobEvent(input.writer, {
      ...eventCtx,
      type: "saving_files",
      title: "Saving files",
      detail: `${persist.savedCount} files saved`,
      progressPercent: 88,
    });

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
      .select("metadata, app_name")
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

      if (!alreadyCharged && input.reservedCredits && input.reservedCredits > 0) {
        const chargeCalc = calculateCreditsForStagedBuild({
          providerCostUsd: pr.totalProviderCostUsd,
          complexity: pr.complexity,
          inputTokens: pr.totalInputTokens,
          outputTokens: pr.totalOutputTokens,
          primaryModelId: pr.primaryModelId,
          fileCount: postPersist.visibleFileCount,
        });
        const profitable = assertProfitableCharge(
          chargeCalc.creditsToCharge,
          chargeCalc.estimatedProviderCostUsd,
        );
        if (profitable.ok) {
          await reconcileGenerationReservation(input.writer, {
            userId: input.userId,
            generationId: input.operationId,
            reservedCredits: input.reservedCredits,
            actualUserCredits: Math.min(input.reservedCredits, chargeCalc.creditsToCharge),
            providerCostUsd: chargeCalc.estimatedProviderCostUsd,
            success: true,
            projectId: input.projectId,
          });
        }
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

    if (!persist.persistOk || persist.savedCount < MIN_RENDERABLE_FILES || !fileGate.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[execute-staged-build] files_persistence_failed", {
          projectId: input.projectId,
          persistOk: persist.ok,
          savedCount: persist.savedCount,
          renderableCount: persist.renderableCount,
          persistError: persist.error,
          fileGateFailures: fileGate.failures,
        });
      }
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

      const failDetail =
        fileGate.failures.join("; ") ||
        persist.error ||
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
        errorMessage: failDetail,
        skipJobStatusUpdate: true,
      });

      const persistFailKind = failureKindForPersist({
        fileCount: 0,
        repairAttempted: false,
      });
      await persistBuildJobEvent(input.writer, {
        ...eventCtx,
        type: "failed",
        title: userSafeFailureTitle(persistFailKind),
        detail: userSafeFailureDetail(
          persistFailKind,
          fileGate.code ?? "files_persistence_failed",
        ),
        progressPercent: 100,
        metadata: {
          failures: fileGate.failures,
          persist_error: persist.error,
          failure_kind: persistFailKind,
          file_count: 0,
        },
      });
      return;
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
    let previewStillFailed =
      !staticPreviewOk && (!previewResult.ok || !postPreview.shouldComplete);
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
          previewStillFailed =
            !isStaticPreviewSnapshotHealthy(postPreviewHtml, workingFiles.length) &&
            (!previewResult.ok || !postPreview.shouldComplete);
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
      previewErr =
        userMessageForPreviewFailure(previewCode) ||
        (!previewResult.ok ? (previewResult.error ?? previewErr) : previewErr);
      const filesKept = Math.max(fileGate.fileCount, postPreview.visibleFileCount);

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
          failure_kind: "failed_after_generation",
          preview_failure_code: previewCode,
          source_integrity_ok: postPreview.sourceIntegrity.sourceIntegrityOk,
          preview_renderable: postPreview.sourceIntegrity.previewRenderable,
          blocked_reason: postPreview.sourceIntegrity.blockedReason,
          execution_instance_id: workerCtx.executionInstanceId,
          credits_refunded: false,
        },
      });

      if (!alreadyCharged && input.reservedCredits && input.reservedCredits > 0) {
        const chargeCalc = calculateCreditsForStagedBuild({
          providerCostUsd: pr.totalProviderCostUsd,
          complexity: pr.complexity,
          inputTokens: pr.totalInputTokens,
          outputTokens: pr.totalOutputTokens,
          primaryModelId: pr.primaryModelId,
          fileCount: filesKept,
        });
        const profitable = assertProfitableCharge(
          chargeCalc.creditsToCharge,
          chargeCalc.estimatedProviderCostUsd,
        );
        if (profitable.ok) {
          await reconcileGenerationReservation(input.writer, {
            userId: input.userId,
            generationId: input.operationId,
            reservedCredits: input.reservedCredits,
            actualUserCredits: Math.min(input.reservedCredits, chargeCalc.creditsToCharge),
            providerCostUsd: chargeCalc.estimatedProviderCostUsd,
            success: true,
            projectId: input.projectId,
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
    if (!alreadyCharged && input.reservedCredits && input.reservedCredits > 0) {
      const chargeCalc = calculateCreditsForStagedBuild({
        providerCostUsd: pr.totalProviderCostUsd,
        complexity: pr.complexity,
        inputTokens: pr.totalInputTokens,
        outputTokens: pr.totalOutputTokens,
        primaryModelId: pr.primaryModelId,
        fileCount: fileGate.fileCount,
      });

      const profitable = assertProfitableCharge(
        chargeCalc.creditsToCharge,
        chargeCalc.estimatedProviderCostUsd,
      );

      if (profitable.ok) {
        const recon = await reconcileGenerationReservation(input.writer, {
          userId: input.userId,
          generationId: input.operationId,
          reservedCredits: input.reservedCredits,
          actualUserCredits: Math.min(input.reservedCredits, chargeCalc.creditsToCharge),
          providerCostUsd: chargeCalc.estimatedProviderCostUsd,
          success: true,
          projectId: input.projectId,
        });
        creditsCharged = recon.finalCharged;

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
          creditsCharged: recon.finalCharged,
          charged: true,
          skipJobStatusUpdate: true,
        });
      }
    }

    const previewLive = isStaticPreviewSnapshotHealthy(
      postPreviewHtml,
      workingFiles.length,
    );

    const richnessOk = pr.uiRichnessPasses && pr.uiQualityScore >= 85;
    const canShowDone = previewLive && richnessOk && pr.buildContract.previewReady;
    const doneSummary = canShowDone
      ? pr.meta?.summary?.trim() ||
        `Done — preview is ready for ${pr.appName} (${fileGate.fileCount} files).`
      : richnessOk
        ? `Draft generated — improving UI quality (${fileGate.fileCount} files saved).`
        : `Draft saved — additional generation needed (${fileGate.fileCount} files).`;
    await persistAssistantBuildMessage(input.writer, eventCtx, {
      message: doneSummary.slice(0, 280),
      progressPercent: 98,
    });
    await persistBuildJobEvent(input.writer, {
      ...eventCtx,
      type: "completed",
      title: canShowDone ? "Done — preview is ready" : richnessOk ? "Draft generated" : "Draft saved",
      detail: canShowDone
        ? "Preview is live with rich dashboard UI."
        : richnessOk
          ? "Draft generated — improving UI quality."
          : "Draft saved — additional generation needed.",
      progressPercent: 100,
      metadata: {
        credits_charged: creditsCharged,
        preview_url: resolvedPreviewUrl,
        files_persisted: fileGate.fileCount,
        stream_category: "completed",
        source_integrity_ok: postPreview.sourceIntegrity.sourceIntegrityOk,
        preview_renderable: previewLive,
        ui_richness_passes: richnessOk,
        ui_quality_score: pr.uiQualityScore,
        ready_reason: previewLive ? "source_integrity_ok_preview_live" : "preview_pending",
      },
    });

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
