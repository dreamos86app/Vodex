import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { runStagedBuildPipeline } from "@/lib/build/build-pipeline";
import { calculateCreditsForStagedBuild } from "@/lib/credits/credit-pricing";
import { reconcileGenerationReservation } from "@/lib/billing/credit-reservations";
import { assertProfitableCharge } from "@/lib/billing/credit-profit-guard";
import { finalizeBuildSuccess, finalizeBuildFailed } from "@/lib/build/finalize-build";
import { getAppUrl } from "@/lib/app-url";
import { hasSuccessfulChargeForOperation } from "@/lib/chat/server-idempotency";
import { persistGeneratedBuildFiles } from "@/lib/build/persist-generated-files";
import { assertBuildFilesPersisted } from "@/lib/build/assert-build-files-persisted";
import { startPreviewSession } from "@/lib/preview/preview-build-service";
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";
import { canCompleteWithSavedFiles } from "@/lib/build/post-build-contract";
import { lifecyclePatch } from "@/lib/projects/project-lifecycle";

type Writer = SupabaseClient<Database>;

async function refundBuildReservation(input: {
  writer: Writer;
  userId: string;
  operationId: string;
  reservedCredits?: number;
  providerCostUsd: number;
  projectId: string;
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
  });
}

export function createStagedBuildStreamResponse(input: {
  uiMessages: UIMessage[];
  writer: Writer;
  userId: string;
  userEmail: string;
  operationId: string;
  projectId: string;
  buildJobId: string | null;
  userPrompt: string;
  memoryBlock: string;
  conversationId?: string;
  modelId: string;
  provider: string;
  routeReason: string;
  reservedCredits?: number;
  blueprintBlock?: string;
  userSelectedModelId?: string | null;
}): Response {
  let pipelineResult: Awaited<ReturnType<typeof runStagedBuildPipeline>> | null = null;

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages: input.uiMessages,
      execute: async ({ writer }) => {
        const textId = `text-${input.operationId}`;
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta: "Building your first version…\n\n",
        });

        pipelineResult = await runStagedBuildPipeline({
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
        });

        const text = pipelineResult.visibleText;
        for (let i = 0; i < text.length; i += 100) {
          writer.write({
            type: "text-delta",
            id: textId,
            delta: text.slice(i, i + 100),
          });
        }
        writer.write({ type: "text-end", id: textId });
      },
      onFinish: async ({ isAborted }) => {
        if (isAborted || !pipelineResult) return;

        const pr = pipelineResult;
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
              build_success: pr.ok,
            } as never,
          });
        }

        const persist = await persistGeneratedBuildFiles({
          writer: input.writer,
          projectId: input.projectId,
          ownerId: input.userId,
          files: pr.files,
        });

        const fileGate = await assertBuildFilesPersisted({
          writer: input.writer,
          projectId: input.projectId,
          archetypeId: pr.appArchetype,
        });

        const filesSavable =
          persist.ok &&
          persist.savedCount >= MIN_RENDERABLE_FILES &&
          canCompleteWithSavedFiles(fileGate.fileCount, fileGate.failures);

        const previewResult = filesSavable
          ? await startPreviewSession({
              writer: input.writer,
              userId: input.userId,
              projectId: input.projectId,
            })
          : { ok: false as const, error: "files not persisted", code: "no_files" };

        const buildSucceeded =
          pr.ok &&
          pr.buildContract.passed &&
          filesSavable &&
          previewResult.ok;

        if (!buildSucceeded) {
          await refundBuildReservation({
            writer: input.writer,
            userId: input.userId,
            operationId: input.operationId,
            reservedCredits: input.reservedCredits,
            providerCostUsd: pr.totalProviderCostUsd,
            projectId: input.projectId,
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
                file_count: persist.savedCount,
                ui_quality_score: pr.uiQualityScore,
              } as Json,
            } as never)
            .eq("id", input.projectId)
            .eq("owner_id", input.userId);

          if (input.buildJobId) {
            await finalizeBuildFailed({
              writer: input.writer,
              buildJobId: input.buildJobId,
              projectId: input.projectId,
              userId: input.userId,
              errorMessage: pr.buildContract.userMessage,
            });
          }
          return;
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
        });

        if (!alreadyCharged && input.reservedCredits && input.reservedCredits > 0) {
          const chargeCalc = calculateCreditsForStagedBuild({
            providerCostUsd: pr.totalProviderCostUsd,
            complexity: pr.complexity,
            inputTokens: pr.totalInputTokens,
            outputTokens: pr.totalOutputTokens,
            primaryModelId: pr.primaryModelId,
            fileCount: persist.savedCount,
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

            if (input.buildJobId) {
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
                fileCount: persist.savedCount,
                creditsCharged: recon.finalCharged,
                charged: true,
              });
            }
          }
        }
      },
    }),
  });
}
