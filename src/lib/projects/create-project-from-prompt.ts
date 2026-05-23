import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { classifyCreateIntent } from "@/lib/intent/create-intent-classifier";
import {
  lifecyclePatch,
  type ProjectLifecycleStatus,
} from "@/lib/projects/project-lifecycle";
import { slugifyAppName } from "@/lib/publish/app-slug";

type Writer = SupabaseClient<Database>;

export type CreateFromPromptInput = {
  writer: Writer;
  userId: string;
  prompt: string;
  source?: "prompt" | "template" | "import";
  existingProjectId?: string | null;
  templateId?: string | null;
  stylePresetId?: string | null;
  buildTier?: "quick" | "standard" | "production";
};

export type CreateFromPromptResult =
  | {
      ok: true;
      projectId: string;
      slug: string;
      intent: string;
      lifecycleStatus: ProjectLifecycleStatus;
      shouldFullBuild: boolean;
      needsClarification: boolean;
      userMessage: string;
    }
  | { ok: false; error: string; code: string; intent?: string; userMessage?: string };

function uniqueSlug(base: string): string {
  return `${slugifyAppName(base)}-${Date.now().toString(36).slice(-6)}`;
}

export async function createProjectFromPrompt(
  input: CreateFromPromptInput,
): Promise<CreateFromPromptResult> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    return { ok: false, error: "Prompt is required", code: "empty_prompt" };
  }

  const intentResult = classifyCreateIntent(prompt, Boolean(input.existingProjectId));

  if (intentResult.intent === "question_only" || intentResult.intent === "unsafe_or_invalid") {
    return {
      ok: false,
      error: intentResult.userMessage,
      code: intentResult.intent,
      intent: intentResult.intent,
      userMessage: intentResult.userMessage,
    };
  }

  if (intentResult.needsClarification && !intentResult.shouldCreateProject) {
    return {
      ok: false,
      error: intentResult.clarificationPrompt ?? intentResult.userMessage,
      code: "needs_clarification",
      intent: intentResult.intent,
      userMessage: intentResult.userMessage,
    };
  }

  if (intentResult.intent === "app_edit_request" && !input.existingProjectId) {
    return {
      ok: false,
      error: intentResult.userMessage,
      code: "edit_no_app",
      intent: intentResult.intent,
      userMessage: intentResult.userMessage,
    };
  }

  if (input.existingProjectId) {
    const { data } = await input.writer
      .from("projects")
      .select("id, slug")
      .eq("id", input.existingProjectId)
      .eq("owner_id", input.userId)
      .maybeSingle();
    if (!data?.id) {
      return { ok: false, error: "Project not found", code: "not_found" };
    }
    const lifecycle: ProjectLifecycleStatus = intentResult.shouldFullBuild
      ? "blueprint_generating"
      : "intent_review";
    const prev = await input.writer
      .from("projects")
      .select("metadata")
      .eq("id", data.id)
      .maybeSingle();
    const prevMeta =
      prev.data?.metadata && typeof prev.data.metadata === "object" && !Array.isArray(prev.data.metadata)
        ? (prev.data.metadata as Record<string, unknown>)
        : {};
    await input.writer
      .from("projects")
      .update({
        status: "draft",
        metadata: {
          ...prevMeta,
          ...lifecyclePatch(lifecycle, {
            initial_prompt: prompt,
            source: input.source ?? "prompt",
            workflow_step: "intent_review",
            last_intent: intentResult.intent,
            template_id: input.templateId ?? null,
            style_preset_id: input.stylePresetId ?? "minimal",
            build_tier: input.buildTier ?? "standard",
            create_flow_state: "project_ready",
          }),
        },
      } as never)
      .eq("id", data.id);
    return {
      ok: true,
      projectId: data.id,
      slug: data.slug ?? uniqueSlug(prompt.slice(0, 40)),
      intent: intentResult.intent,
      lifecycleStatus: lifecycle,
      shouldFullBuild: intentResult.shouldFullBuild,
      needsClarification: intentResult.needsClarification,
      userMessage: intentResult.userMessage,
    };
  }

  if (!intentResult.shouldCreateProject) {
    return {
      ok: false,
      error: intentResult.userMessage,
      code: intentResult.intent,
      intent: intentResult.intent,
      userMessage: intentResult.userMessage,
    };
  }

  const name = prompt.slice(0, 80) || "New app";
  const slug = uniqueSlug(name);
  const lifecycle: ProjectLifecycleStatus = intentResult.shouldFullBuild
    ? "blueprint_generating"
    : intentResult.intent === "app_idea" || intentResult.intent === "design_request"
      ? "intent_review"
      : "blueprint_generating";

  const { data, error } = await input.writer
    .from("projects")
    .insert({
      owner_id: input.userId,
      name,
      slug,
      status: "draft",
      framework: "nextjs",
      build_status: null,
      metadata: lifecyclePatch(lifecycle, {
        initial_prompt: prompt,
        source: input.source ?? "prompt",
        workflow_step: "intent_review",
        last_intent: intentResult.intent,
        template_id: input.templateId ?? null,
        style_preset_id: input.stylePresetId ?? "minimal",
        build_tier: input.buildTier ?? "standard",
        create_flow_state: "project_ready",
      }),
    } as never)
    .select("id, slug")
    .single();

  if (error || !data?.id) {
    return {
      ok: false,
      error: error?.message ?? "Could not create project",
      code: "project_error",
    };
  }

  return {
    ok: true,
    projectId: data.id,
    slug: data.slug ?? slug,
    intent: intentResult.intent,
    lifecycleStatus: lifecycle,
    shouldFullBuild: intentResult.shouldFullBuild,
    needsClarification: intentResult.needsClarification,
    userMessage: intentResult.userMessage,
  };
}
