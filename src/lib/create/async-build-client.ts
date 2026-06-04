import type { ChatTransportBody } from "@/lib/chat/create-chat-transport";

export type AsyncBuildEnqueueResponse = {
  ok?: boolean;
  asyncBuild?: boolean;
  buildJobId?: string;
  operationId?: string;
  projectId?: string;
  conversationId?: string | null;
  eventsUrl?: string;
  error?: string;
  code?: string;
  hint?: string;
};

async function parseEnqueueResponse(res: Response): Promise<AsyncBuildEnqueueResponse & {
  tokens_remaining?: number;
  tokens_required?: number;
}> {
  const contentType = res.headers.get("content-type") ?? "";

  if (
    contentType.includes("text/event-stream") ||
    (contentType.includes("text/plain") && !contentType.includes("json"))
  ) {
    const snippet = (await res.text()).slice(0, 200);
    throw new Error(
      snippet.startsWith("data:")
        ? "Build returned a chat stream instead of a background job. Retry, or switch to Discuss if this was meant as a question."
        : `Unexpected build response (${res.status}). Expected JSON, got ${contentType || "unknown"}.`,
    );
  }

  try {
    return (await res.json()) as AsyncBuildEnqueueResponse & {
      tokens_remaining?: number;
      tokens_required?: number;
    };
  } catch (err) {
    const snippet = (await res.clone().text().catch(() => "")).slice(0, 200);
    if (snippet.startsWith("data:")) {
      throw new Error(
        "Build returned a chat stream instead of a background job. Retry, or switch to Discuss if this was meant as a question.",
      );
    }
    throw err instanceof Error ? err : new Error("Invalid build enqueue response");
  }
}

export async function enqueueAsyncBuild(input: {
  messages: unknown[];
  body: ChatTransportBody & { operationId?: string; idempotencyKey?: string };
}): Promise<AsyncBuildEnqueueResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-DreamOS-Async-Build": "1",
    },
    credentials: "include",
    body: JSON.stringify({
      messages: input.messages,
      ...input.body,
      mode: "build",
      strategy: input.body.strategy ?? "build_now",
      forceBuildPipeline: input.body.forceBuildPipeline === true,
      planFirstOnly:
        input.body.planFirstOnly ??
        (input.body.strategy === "plan_first" && input.body.forceBuildPipeline !== true),
    }),
  });

  const data = await parseEnqueueResponse(res);

  if (res.status === 402) {
    const err = new Error(data.error ?? "Insufficient credits");
    (err as Error & { code?: string }).code = data.code ?? "insufficient_tokens";
    throw err;
  }

  if (res.status === 409 || data.code === "build_pipeline_unavailable") {
    throw new Error(
      data.hint ??
        data.error ??
        "This prompt was treated as a question, not a full build. Rephrase with “Build …” or use Discuss.",
    );
  }

  if (!res.ok) {
    throw new Error(data.error ?? data.hint ?? `Build enqueue failed (${res.status})`);
  }

  if (res.status !== 202 || !data.asyncBuild || !data.buildJobId || !data.eventsUrl) {
    throw new Error(
      data.error ?? "Server did not start a background build job. Try again or use Discuss mode.",
    );
  }

  return data;
}
