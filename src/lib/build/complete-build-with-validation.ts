import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { validateGeneratedApp } from "@/lib/build/generated-app-validator";
import { reviewGeneratedUi, uiQualityBlocksGenerated } from "@/lib/generation/generated-ui-review";
import { planUiPolishPass } from "@/lib/generation/ui-polish-pass";
import { readCreateFlowConfig } from "@/lib/create/create-flow-config";
import {
  lifecyclePatch,
  legacyProjectStatus,
  type ProjectLifecycleStatus,
} from "@/lib/projects/project-lifecycle";

type Writer = SupabaseClient<Database>;

export type BuildCompletionResult = {
  lifecycle: ProjectLifecycleStatus;
  validationOk: boolean;
  validationReasons: string[];
  fileCount: number;
  canPreview: boolean;
  canPublish: boolean;
  uiQualityScore?: number;
  needsUiPolish?: boolean;
  uiPolishQuotedCredits?: number;
  uiPolishIncluded?: boolean;
};

/** Load project files and derive lifecycle — used on every build completion path. */
export async function completeBuildWithValidation(input: {
  writer: Writer;
  userId: string;
  projectId: string;
  previewUrl?: string | null;
}): Promise<BuildCompletionResult> {
  const { data: files } = await input.writer
    .from("app_files")
    .select("path, content")
    .eq("project_id", input.projectId)
    .limit(200);

  const { data: cur } = await input.writer
    .from("projects")
    .select("metadata, preview_url")
    .eq("id", input.projectId)
    .eq("owner_id", input.userId)
    .maybeSingle();

  const prevMeta =
    cur?.metadata && typeof cur.metadata === "object" && !Array.isArray(cur.metadata)
      ? (cur.metadata as Record<string, unknown>)
      : {};

  const createCfg = readCreateFlowConfig(prevMeta);
  const appType =
    typeof prevMeta.app_type === "string"
      ? prevMeta.app_type
      : typeof prevMeta.blueprint_app_type === "string"
        ? prevMeta.blueprint_app_type
        : null;
  const routeMap = Array.isArray(prevMeta.blueprint_routes)
    ? (prevMeta.blueprint_routes as string[])
    : null;

  const fileRows = (files ?? []).map((f) => ({ path: f.path!, content: f.content! }));
  const validation = validateGeneratedApp({
    files: fileRows,
    projectId: input.projectId,
    ownerId: input.userId,
    routeMap,
  });

  const uiReview = reviewGeneratedUi({
    files: fileRows,
    appType,
    stylePresetId: createCfg.stylePresetId,
    routeMap,
  });

  const polishPlan = planUiPolishPass({
    files: fileRows,
    ctx: {
      appType,
      stylePresetId: createCfg.stylePresetId,
      templateId: createCfg.templateId,
      buildTier: createCfg.buildTier,
      routeMap,
    },
    buildTier: createCfg.buildTier,
  });

  const uiOk = !uiQualityBlocksGenerated(uiReview);
  const validationOk = validation.ok && uiOk;
  const validationReasons = [
    ...validation.reasons,
    ...(uiOk
      ? []
      : [
          `ui_quality_low:${uiReview.overall}`,
          `app_type_score:${uiReview.appTypeScore}`,
          ...uiReview.issues.slice(0, 5),
        ]),
  ];

  const fileCount = fileRows.length;
  let lifecycle: ProjectLifecycleStatus = "needs_attention";

  if (fileCount === 0) {
    lifecycle = "needs_attention";
  } else if (!validationOk) {
    lifecycle = "needs_attention";
  } else {
    // Preview lifecycle is set only after a successful preview session — never here.
    lifecycle = "generated";
  }

  const repairAction = validationOk
    ? null
    : uiReview.needsPolish
      ? polishPlan.includedInReservation
        ? "ui_polish_pass"
        : "ui_polish_quote"
      : "open_builder_retry";

  await input.writer
    .from("projects")
    .update({
      status: legacyProjectStatus(lifecycle),
      build_status: validationOk && fileCount > 0 ? "completed" : "failed",
      preview_url: null,
      metadata: {
        ...prevMeta,
        ...lifecyclePatch(lifecycle, {
          validation_ok: validationOk,
          validation_reasons: validationReasons.slice(0, 10),
          ui_quality_score: uiReview.overall,
          ui_app_type_score: uiReview.appTypeScore,
          ui_style_preset_score: uiReview.stylePresetScore,
          ui_placeholder_risk: uiReview.dimensions.placeholderRisk,
          ui_needs_polish: uiReview.needsPolish,
          ui_polish_quoted_credits: polishPlan.quoted ? polishPlan.estimatedCredits : null,
          ui_polish_included: polishPlan.includedInReservation && uiReview.needsPolish,
          repair_action: repairAction,
          build_status: validationOk && fileCount > 0 ? "completed" : "needs_repair",
          preview_ready: false,
          preview_honest: false,
        }),
      },
    } as never)
    .eq("id", input.projectId)
    .eq("owner_id", input.userId);

  return {
    lifecycle,
    validationOk,
    validationReasons,
    fileCount,
    canPreview: validationOk && fileCount > 0,
    canPublish: Boolean(prevMeta.preview_ready) && validationOk && fileCount > 0,
    uiQualityScore: uiReview.overall,
    needsUiPolish: uiReview.needsPolish,
    uiPolishQuotedCredits: polishPlan.quoted ? polishPlan.estimatedCredits : undefined,
    uiPolishIncluded: polishPlan.includedInReservation && uiReview.needsPolish,
  };
}
