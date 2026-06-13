import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { loadMemory, formatMemoryForPrompt } from "@/lib/creation/memory";
import { loadProjectContextBlock } from "@/lib/projects/project-context";
import { parseAppBlueprint } from "@/lib/build/blueprint-schema";
import { readCreateFlowConfig } from "@/lib/create/create-flow-config";
import { formatBlueprintForBuild } from "@/lib/build/format-blueprint-prompt";
import type { ExecuteStagedBuildJobInput } from "@/lib/build/execute-staged-build-job";

type Writer = SupabaseClient<Database>;

function metaRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

async function resolveBlueprintBlock(
  writer: Writer,
  projectId: string,
  userPrompt: string,
): Promise<string> {
  const { data: projMetaRow } = await writer
    .from("projects")
    .select("metadata")
    .eq("id", projectId)
    .maybeSingle();
  const buildMeta = metaRecord(projMetaRow?.metadata);
  const buildCfg = readCreateFlowConfig(buildMeta);
  const buildUiCtx = {
    stylePresetId: buildCfg.stylePresetId,
    templateId: buildCfg.templateId,
    buildTier: buildCfg.buildTier,
  };

  const stored = buildMeta.approved_blueprint;
  if (stored) {
    const parsed = parseAppBlueprint(stored);
    if (parsed.ok) return formatBlueprintForBuild(parsed.blueprint, buildUiCtx);
  }
  return "";
}

/** Reconstruct executeStagedBuildJob input from persisted build_jobs row (long-running worker route). */
export async function resolveStagedBuildJobInput(
  writer: Writer,
  projectId: string,
  buildJobId: string,
): Promise<ExecuteStagedBuildJobInput | null> {
  const { data: job } = await writer
    .from("build_jobs")
    .select(
      "id, user_id, project_id, conversation_id, prompt, status, meta",
    )
    .eq("id", buildJobId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!job?.user_id || !job.project_id) return null;
  if (job.status !== "running" && job.status !== "queued" && job.status !== "starting") {
    return null;
  }

  const meta = metaRecord(job.meta);
  const userId = job.user_id;
  const userPrompt =
    (typeof meta.user_prompt === "string" ? meta.user_prompt : null) ??
    (typeof job.prompt === "string" ? job.prompt : "") ??
    "";

  const operationId =
    (typeof meta.operation_id === "string" ? meta.operation_id : null) ??
    `build:${userId}:${projectId}:${buildJobId}`;

  const modelId =
    (typeof meta.user_selected_model_id === "string" ? meta.user_selected_model_id : null) ??
    (typeof meta.primary_model_id === "string" ? meta.primary_model_id : null) ??
    (typeof meta.model_id === "string" ? meta.model_id : null) ??
    "automatic";

  const { data: profile } = await writer
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  const userEmail = profile?.email ?? "unknown@dreamos.local";

  const { entries } = await loadMemory(writer, { projectId, limit: 30 });
  let memoryBlock = formatMemoryForPrompt(entries);
  const projectCtx = await loadProjectContextBlock(writer, projectId, userId);
  if (projectCtx) {
    memoryBlock = memoryBlock
      ? `${memoryBlock}\n\n---\nCurrent project state:\n${projectCtx}\n---`
      : `---\nCurrent project state:\n${projectCtx}\n---`;
  }

  const blueprintBlock = await resolveBlueprintBlock(writer, projectId, userPrompt);

  return {
    writer,
    userId,
    userEmail,
    operationId,
    projectId,
    buildJobId,
    userPrompt,
    memoryBlock,
    conversationId: job.conversation_id ?? undefined,
    modelId,
    reservedCredits:
      typeof meta.reserved_credits === "number" ? meta.reserved_credits : undefined,
    partialCreditBuild: meta.partial_credit_build === true,
    quotedCreditsRequired:
      typeof meta.quoted_credits_required === "number"
        ? meta.quoted_credits_required
        : undefined,
    blueprintBlock: blueprintBlock || undefined,
    userSelectedModelId:
      (typeof meta.user_selected_model_id === "string"
        ? meta.user_selected_model_id
        : modelId) ?? null,
    resumeContinuation: meta.resume_continuation === true,
  };
}

export async function persistBuildJobExecutionMeta(
  writer: Writer,
  buildJobId: string,
  patch: {
    reservedCredits?: number;
    partialCreditBuild?: boolean;
    quotedCreditsRequired?: number;
    userSelectedModelId?: string;
    resumeContinuation?: boolean;
    operationId?: string;
  },
): Promise<void> {
  const { data: job } = await writer
    .from("build_jobs")
    .select("meta")
    .eq("id", buildJobId)
    .maybeSingle();
  const prev = metaRecord(job?.meta);
  await writer
    .from("build_jobs")
    .update({
      meta: {
        ...prev,
        ...(patch.operationId ? { operation_id: patch.operationId } : {}),
        ...(typeof patch.reservedCredits === "number"
          ? { reserved_credits: patch.reservedCredits }
          : {}),
        ...(patch.partialCreditBuild != null
          ? { partial_credit_build: patch.partialCreditBuild }
          : {}),
        ...(typeof patch.quotedCreditsRequired === "number"
          ? { quoted_credits_required: patch.quotedCreditsRequired }
          : {}),
        ...(patch.userSelectedModelId
          ? { user_selected_model_id: patch.userSelectedModelId }
          : {}),
        ...(patch.resumeContinuation != null
          ? { resume_continuation: patch.resumeContinuation }
          : {}),
      } as Json,
    } as never)
    .eq("id", buildJobId);
}
