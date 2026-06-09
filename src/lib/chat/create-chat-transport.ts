"use client";

import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { createChatFetch } from "@/lib/chat/create-chat-fetch";

export type ChatTransportBody = {
  modelId: string;
  mode: "discuss" | "edit" | "build";
  /** Frozen at submit — server uses this as authoritative task mode. */
  mode_at_submit?: "discuss" | "edit" | "build";
  /** Explicit build strategy for server routing (never infer plan-first from prompt heuristics alone). */
  strategy?: "build_now" | "plan_first";
  /** When true with strategy=build_now, server must enqueue async build (not discuss/plan). */
  forceBuildPipeline?: boolean;
  scope?: string | null;
  editTarget?: string | null;
  projectId?: string;
  conversationId?: string;
  attachmentIds?: string[];
  operationId?: string;
  idempotencyKey?: string;
  approvedBlueprint?: Record<string, unknown> | null;
  qualityLevel?: string;
  templateId?: string;
  stylePresetId?: string;
  /** Create-page question answer — flat 0.8 credit pricing, no project creation. */
  createQuestion?: boolean;
  planFirstOnly?: boolean;
  /** Resume route-by-route continuation without replanning or identity. */
  resumeContinuation?: boolean;
};

export function createDreamChatTransport({
  getBody,
  on402,
  onSuccess,
  onFetchStart,
  onFetchEnd,
  label,
}: {
  getBody: () => ChatTransportBody;
  on402?: () => void;
  onSuccess?: () => void;
  onFetchStart?: (url: string) => void;
  onFetchEnd?: (status: number) => void;
  label?: string;
}) {
  return new DefaultChatTransport<UIMessage>({
    api: "/api/chat",
    fetch: (reqInput, init) =>
      createChatFetch(reqInput, init, {
        label: label ?? "chat",
        on402,
        onSuccess,
        onFetchStart,
        onFetchEnd,
      }),
    prepareSendMessagesRequest: ({ id, messages, body, trigger, messageId }) => {
      const extra = getBody();
      const requestBody = (body ?? {}) as Partial<ChatTransportBody>;
      const isCreateQuestion =
        requestBody.createQuestion === true || extra.createQuestion === true;
      return {
        body: {
          ...requestBody,
          id,
          messages,
          trigger,
          messageId,
          modelId: extra.modelId,
          mode: extra.mode,
          mode_at_submit: requestBody.mode_at_submit ?? extra.mode_at_submit ?? extra.mode,
          strategy: requestBody.strategy ?? extra.strategy,
          forceBuildPipeline: requestBody.forceBuildPipeline ?? extra.forceBuildPipeline,
          planFirstOnly: requestBody.planFirstOnly ?? extra.planFirstOnly,
          scope: requestBody.scope ?? extra.scope ?? undefined,
          editTarget: requestBody.editTarget ?? extra.editTarget ?? undefined,
          projectId: isCreateQuestion
            ? undefined
            : (requestBody.projectId ?? extra.projectId),
          conversationId: requestBody.conversationId ?? extra.conversationId,
          attachmentIds: requestBody.attachmentIds ?? extra.attachmentIds,
          operationId:
            requestBody.operationId ??
            requestBody.idempotencyKey ??
            extra.operationId ??
            extra.idempotencyKey,
          idempotencyKey:
            requestBody.idempotencyKey ??
            requestBody.operationId ??
            extra.idempotencyKey ??
            extra.operationId,
          approvedBlueprint:
            requestBody.approvedBlueprint ?? extra.approvedBlueprint ?? undefined,
          createQuestion: isCreateQuestion ? true : undefined,
        },
      };
    },
  });
}
