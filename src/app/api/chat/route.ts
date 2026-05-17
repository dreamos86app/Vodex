import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  loadMemory,
  formatMemoryForPrompt,
} from "@/lib/creation/memory";
import { buildOrchestrationSystem } from "@/lib/creation/orchestration";

const MODEL_CREDITS: Record<string, number> = {
  "claude-3-5-sonnet": 3,
  "claude-3-5-haiku": 1,
  "claude-opus-4": 10,
  "gpt-4o": 4,
  "gpt-4o-mini": 1,
  "gemini-2-0-flash": 1,
  "gemini-2-5-pro": 5,
  "deepseek-chat": 1,
};

const CREDITS_PER_MESSAGE = (modelId: string) => MODEL_CREDITS[modelId] ?? 2;

function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last?.parts?.length) return "";
  return last.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function getModel(modelId: string) {
  if (modelId.startsWith("claude")) {
    return anthropic(modelId);
  }
  if (modelId.startsWith("gpt")) {
    return openai(modelId);
  }
  if (modelId.startsWith("gemini")) {
    const geminiId = modelId
      .replace("gemini-2-0-flash", "gemini-2.0-flash")
      .replace("gemini-2-5-pro", "gemini-2.5-pro");
    return google(geminiId);
  }
  return anthropic("claude-3-5-haiku-20241022");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: {
    messages?: UIMessage[];
    modelId?: string;
    conversationId?: string;
    mode?: "discuss" | "edit" | "build";
    scope?: string | null;
    projectId?: string;
  };

  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const uiMessages = raw.messages ?? [];
  if (!Array.isArray(uiMessages) || uiMessages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const modelId = typeof raw.modelId === "string" && raw.modelId.length > 0
    ? raw.modelId
    : "claude-3-5-sonnet";
  const conversationId =
    typeof raw.conversationId === "string" && raw.conversationId.length > 0
      ? raw.conversationId
      : undefined;
  const mode: "discuss" | "edit" | "build" =
    raw.mode === "edit" ? "edit" : raw.mode === "build" ? "build" : "discuss";
  const scope = typeof raw.scope === "string" ? raw.scope : null;
  const projectId =
    typeof raw.projectId === "string" && raw.projectId.length > 0
      ? raw.projectId
      : undefined;

  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(uiMessages, {
      ignoreIncompleteToolCalls: true,
    });
  } catch {
    return NextResponse.json({ error: "Invalid messages payload" }, { status: 400 });
  }

  const creditsNeeded = CREDITS_PER_MESSAGE(modelId);

  const { data: creditResultRaw } = await supabase.rpc("consume_credits", {
    p_user_id: user.id,
    p_amount: creditsNeeded,
    p_operation_id: `chat_${Date.now()}`,
    p_model_id: modelId,
    ...(conversationId ? { p_conversation_id: conversationId } : {}),
  });

  const creditResult = creditResultRaw as
    | { success?: boolean; remaining?: number; error?: string | null }
    | null
    | undefined;

  if (!creditResult?.success) {
    return NextResponse.json(
      {
        error: "insufficient_credits",
        remaining: creditResult?.remaining ?? 0,
      },
      { status: 402 },
    );
  }

  const userText = lastUserText(uiMessages);

  if (conversationId && userText) {
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: "user",
      content: userText,
      credits_used: creditsNeeded,
      model_id: modelId,
    });
  }

  supabase
    .from("analytics_events")
    .insert({
      user_id: user.id,
      event_type: "ai_generation",
      properties: { model_id: modelId, credits: creditsNeeded },
    })
    .then(() => {});

  // ─── Memory injection (real, persistent) ──────────────────────────────────
  let memoryBlock = "";
  if (projectId) {
    const { entries } = await loadMemory(supabase, { projectId, limit: 30 });
    memoryBlock = formatMemoryForPrompt(entries);
  }

  const systemPrompt = buildOrchestrationSystem({
    mode,
    scope,
    projectMemoryBlock: memoryBlock,
    hasProject: !!projectId,
  });

  try {
    const model = getModel(modelId);
    const result = streamText({
      model,
      messages: modelMessages,
      system: systemPrompt,
      onFinish: async (event) => {
        if (!conversationId) return;
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: "assistant",
          content: event.text,
          model_id: modelId,
          finish_reason: event.finishReason,
          tokens_input: event.usage.inputTokens ?? null,
          tokens_output: event.usage.outputTokens ?? null,
          metadata: { mode, scope, projectId } as never,
        });
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Model unavailable";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
