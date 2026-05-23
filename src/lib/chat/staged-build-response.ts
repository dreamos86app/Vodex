import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { runStagedBuildPipeline } from "@/lib/build/build-pipeline";
import { calculateCreditsForStagedBuild } from "@/lib/credits/credit-pricing";
import { chargeAiOperation } from "@/lib/credits/charge-ai-operation";
import { reconcileGenerationReservation } from "@/lib/billing/credit-reservations";
import { assertProfitableCharge } from "@/lib/billing/credit-profit-guard";
import { finalizeBuildSuccess, finalizeBuildFailed } from "@/lib/build/finalize-build";
import { completeBuildWithValidation } from "@/lib/build/complete-build-with-validation";
import { allocatePublishedSubdomain } from "@/lib/publish/subdomain";
import { getAppUrl } from "@/lib/app-url";
import { hasSuccessfulChargeForOperation } from "@/lib/chat/server-idempotency";
import type { BuilderOutputContract } from "@/lib/creation/parse-builder-metadata";

type Writer = SupabaseClient<Database>;

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
          delta: "Starting staged build…\n\n",
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
        });

        const text = pipelineResult.visibleText;
        const chunkSize = 100;
        for (let i = 0; i < text.length; i += chunkSize) {
          writer.write({
            type: "text-delta",
            id: textId,
            delta: text.slice(i, i + chunkSize),
          });
        }
        writer.write({ type: "text-end", id: textId });
      },
      onFinish: async ({ isAborted, responseMessage }) => {
        if (isAborted || !pipelineResult) return;

        const pr = pipelineResult;
        const eventText = pr.visibleText;

        if (input.conversationId && eventText) {
          await input.writer.from("messages").insert({
            conversation_id: input.conversationId,
            user_id: input.userId,
            role: "assistant",
            content: eventText,
            model_id: pr.primaryModelId,
            credits_used: 0,
            finish_reason: pr.ok ? "stop" : "error",
            tokens_input: pr.totalInputTokens,
            tokens_output: pr.totalOutputTokens,
            metadata: { mode: "build", staged: true } as never,
          });
        }

        let savedFileCount = 0;
        let savedMeta: BuilderOutputContract | null = pr.meta;
        let savedAppName = pr.meta?.app?.name ?? null;
        let savedIconSvg = pr.iconSvg;

        if (pr.ok && pr.files.length > 0) {
          const rows = pr.files.map((f) => ({
            project_id: input.projectId,
            owner_id: input.userId,
            path: f.path,
            content: f.content,
            language: f.path.split(".").pop() ?? "text",
            mime_type: "text/plain",
            size_bytes: Buffer.byteLength(f.content, "utf8"),
          }));
          const { error: afErr } = await input.writer.from("app_files").upsert(rows as never, {
            onConflict: "project_id,path",
          });
          if (!afErr) {
            savedFileCount = pr.files.length;
            const appName = savedAppName ?? "Dream App";
            const iconApiUrl = `${getAppUrl().replace(/\/$/, "")}/api/projects/${input.projectId}/icon`;
            await input.writer
              .from("projects")
              .update({ icon_url: iconApiUrl, app_icon_url: savedIconSvg } as never)
              .eq("id", input.projectId)
              .eq("owner_id", input.userId);
            await finalizeBuildSuccess({
              writer: input.writer,
              userId: input.userId,
              projectId: input.projectId,
              buildJobId: input.buildJobId,
              appName,
              appSlug: pr.meta?.app?.slug ?? null,
              appDescription: pr.meta?.app?.description ?? null,
              iconSvg: savedIconSvg,
              meta: savedMeta,
              fileCount: savedFileCount,
              creditsCharged: 0,
              charged: false,
            });
            await completeBuildWithValidation({
              writer: input.writer,
              userId: input.userId,
              projectId: input.projectId,
            });
          }
        }

        const shouldCharge = pr.ok && savedFileCount > 0;
        const alreadyCharged = await hasSuccessfulChargeForOperation(
          input.writer,
          input.userId,
          input.operationId,
        );

        if (shouldCharge && !alreadyCharged) {
          const chargeCalc = calculateCreditsForStagedBuild({
            providerCostUsd: pr.totalProviderCostUsd,
            complexity: pr.complexity,
            inputTokens: pr.totalInputTokens,
            outputTokens: pr.totalOutputTokens,
            primaryModelId: pr.primaryModelId,
          });

          const profitable = assertProfitableCharge(
            chargeCalc.creditsToCharge,
            chargeCalc.estimatedProviderCostUsd,
          );

          let creditsCharged = chargeCalc.creditsToCharge;
          let charged = false;

          if (input.reservedCredits && input.reservedCredits > 0) {
            const recon = await reconcileGenerationReservation(input.writer, {
              userId: input.userId,
              generationId: input.operationId,
              reservedCredits: input.reservedCredits,
              actualUserCredits: Math.min(
                input.reservedCredits,
                chargeCalc.creditsToCharge,
              ),
              providerCostUsd: chargeCalc.estimatedProviderCostUsd,
              success: true,
              projectId: input.projectId,
            });
            creditsCharged = recon.finalCharged;
            charged = true;
          } else if (profitable.ok) {
            const charge = await chargeAiOperation(input.writer, {
              userId: input.userId,
              userEmail: input.userEmail,
              amount: chargeCalc.creditsToCharge,
              modelId: pr.primaryModelId,
              mode: "build",
              operationId: input.operationId,
              conversationId: input.conversationId,
              projectId: input.projectId,
              buildJobId: input.buildJobId,
              providerCostUsd: chargeCalc.estimatedProviderCostUsd,
              tokensInput: pr.totalInputTokens,
              tokensOutput: pr.totalOutputTokens,
              provider: input.provider,
              routeReason: input.routeReason,
            });
            charged = charge.charged;
            creditsCharged = chargeCalc.creditsToCharge;
          }

          if (charged && input.buildJobId && savedAppName) {
            await finalizeBuildSuccess({
              writer: input.writer,
              userId: input.userId,
              projectId: input.projectId,
              buildJobId: input.buildJobId,
              appName: savedAppName,
              appSlug: pr.meta?.app?.slug ?? null,
              appDescription: pr.meta?.app?.description ?? null,
              iconSvg: savedIconSvg,
              meta: savedMeta,
              fileCount: savedFileCount,
              creditsCharged,
              charged: true,
            });
          }
        } else if (!pr.ok && input.reservedCredits) {
          await reconcileGenerationReservation(input.writer, {
            userId: input.userId,
            generationId: input.operationId,
            reservedCredits: input.reservedCredits,
            actualUserCredits: 0,
            providerCostUsd: pr.totalProviderCostUsd,
            success: false,
            projectId: input.projectId,
          });
        } else if (!pr.ok && input.buildJobId) {
          await finalizeBuildFailed({
            writer: input.writer,
            buildJobId: input.buildJobId,
            projectId: input.projectId,
            userId: input.userId,
            errorMessage: pr.errorMessage ?? "Staged build failed",
          });
        }

        void responseMessage;
      },
    }),
  });
}
