import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { classifyRepairIssues, type RepairIssue } from "@/lib/repair/repair-classifier";
import { repairActionsFor } from "@/lib/repair/repair-actions";
import {
  normalizeProjectStatus,
  readLifecycleFromMetadata,
} from "@/lib/projects/project-lifecycle";

type Writer = SupabaseClient<Database>;

export type RepairContextResult = {
  issues: RepairIssue[];
  actions: ReturnType<typeof repairActionsFor>;
  meta: Record<string, unknown>;
  lifecycle: string;
  fileCount: number;
  creditsRemaining: number;
  lastCheckpointId: string | null;
  technicalBundle: Record<string, unknown>;
};

export async function loadRepairContext(
  writer: Writer,
  projectId: string,
  userId: string,
  billingCredits: number,
): Promise<RepairContextResult | null> {
  const { data: project } = await writer
    .from("projects")
    .select("id, build_status, metadata, preview_url, published_subdomain, name")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!project) return null;

  const { count } = await writer
    .from("app_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const metaRaw =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const meta = readLifecycleFromMetadata(project.metadata);
  const lifecycle = normalizeProjectStatus(
    {
      lifecycleStatus: meta.lifecycle_status,
      buildStatus: project.build_status,
      fileCount: count ?? 0,
      hasActiveBuildJob: false,
      publishedSubdomain: project.published_subdomain ?? null,
      previewUrl: project.preview_url ?? null,
      blueprintApproved: meta.blueprint_approved,
    },
    project.metadata,
  );

  const validationReasons = Array.isArray(metaRaw.validation_reasons)
    ? metaRaw.validation_reasons.filter((r): r is string => typeof r === "string")
    : [];

  const missingEnv = Array.isArray(metaRaw.missing_env)
    ? metaRaw.missing_env.filter((r): r is string => typeof r === "string")
    : [];

  const previewLogs = Array.isArray(metaRaw.last_preview_logs)
    ? metaRaw.last_preview_logs.filter((r): r is string => typeof r === "string")
    : [];

  const checkpoints = Array.isArray(metaRaw.editor_checkpoints)
    ? (metaRaw.editor_checkpoints as Array<{ id?: string }>)
    : [];
  const lastCheckpointId = checkpoints[0]?.id ?? null;

  const creditsRequired =
    typeof metaRaw.repair_credits_required === "number" ? metaRaw.repair_credits_required : undefined;

  const issues = classifyRepairIssues({
    lifecycleStatus: lifecycle,
    buildStatus: project.build_status,
    fileCount: count ?? 0,
    previewError: typeof metaRaw.last_preview_error === "string" ? metaRaw.last_preview_error : null,
    publishError: typeof metaRaw.last_publish_error === "string" ? metaRaw.last_publish_error : null,
    validationReasons,
    creditsRemaining: billingCredits,
    creditsRequired,
    missingEnv,
    vercelConnected: metaRaw.vercel_connected === false ? false : metaRaw.vercel_connected === true ? true : undefined,
    vercelTokenInvalid: metaRaw.vercel_token_invalid === true,
    migrationMissing: metaRaw.migration_missing === true || metaRaw.schema_repair_needed === true,
    providerCapHit:
      metaRaw.provider_cap_hit === true ||
      (typeof metaRaw.last_generation_error === "string" &&
        /cap|rate limit|429/i.test(metaRaw.last_generation_error)),
    previewLogs,
  });

  const actions = issues.flatMap((i) => repairActionsFor(i.type, projectId));

  const technicalBundle = {
    projectId,
    projectName: project.name,
    lifecycle,
    buildStatus: project.build_status,
    fileCount: count ?? 0,
    issues: issues.map((i) => ({
      type: i.type,
      severity: i.severity,
      technicalDetails: i.technicalDetails,
    })),
    metadataFlags: {
      validation_ok: metaRaw.validation_ok,
      migration_missing: metaRaw.migration_missing,
      vercel_connected: metaRaw.vercel_connected,
    },
    timestamp: new Date().toISOString(),
  };

  return {
    issues,
    actions,
    meta: metaRaw,
    lifecycle,
    fileCount: count ?? 0,
    creditsRemaining: billingCredits,
    lastCheckpointId,
    technicalBundle,
  };
}
