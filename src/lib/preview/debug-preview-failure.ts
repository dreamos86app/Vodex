import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPreviewRuntimeStatus } from "@/lib/preview/load-preview-runtime-status";
import { loadProjectFilesWithContent } from "@/lib/preview/project-preview-html";
import { detectPreviewRoutesFromFiles } from "@/lib/preview/detect-preview-routes";
import {
  classifyPreviewBuildFailure,
  isTrueIncompleteFiles,
  whyUiSaysGeneratedFilesIncomplete,
  type PreviewFailureClassification,
} from "@/lib/preview/preview-failure-classifier";

export type PreviewFailureDebugObject = {
  project_id: string;
  preview_session_id: string | null;
  preview_build_job_id: string | null;
  failure_kind: string;
  failure_stage: string;
  failure_message: string;
  build_logs_tail: string[];
  npm_error: string | null;
  vite_error: string | null;
  typescript_error: string | null;
  missing_imports: string[];
  missing_files: string[];
  invalid_exports: string[];
  unsupported_packages: string[];
  app_files_count: number;
  routes_count: number;
  package_json_exists: boolean;
  entrypoint_exists: boolean;
  preview_artifact_exists: boolean;
  why_ui_says_generated_files_incomplete: string;
  classification: PreviewFailureClassification;
  generation_quality_score: number | null;
  source_integrity_score: number | null;
  preview_build_status: string | null;
};

export async function debugPreviewFailureForProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<PreviewFailureDebugObject | null> {
  const { data: proj } = await supabase
    .from("projects")
    .select("id, metadata, build_status")
    .eq("id", projectId)
    .maybeSingle();

  if (!proj) return null;

  const meta =
    proj.metadata && typeof proj.metadata === "object" && !Array.isArray(proj.metadata)
      ? (proj.metadata as Record<string, unknown>)
      : {};

  const runtime = await loadPreviewRuntimeStatus(supabase, projectId, meta);
  const files = await loadProjectFilesWithContent(supabase, projectId);
  const routes = detectPreviewRoutesFromFiles(
    files.map((f) => ({ path: f.path, content: f.content })),
  );

  const packageJsonExists = files.some((f) => f.path === "package.json");
  const entrypointExists = files.some(
    (f) => /^app\/(page|layout)\.(tsx|jsx)$/i.test(f.path) || f.path === "index.html",
  );
  const previewArtifactExists = Boolean(runtime.artifactPath);

  const classification = classifyPreviewBuildFailure({
    appFilesCount: files.length,
    routesCount: routes.length,
    packageJsonExists,
    entrypointExists,
    previewArtifactExists,
    buildLogs: runtime.buildLogs,
    errorCode: runtime.errorCode,
    blockedReason: runtime.blockedReason,
    userMessage: runtime.userMessage,
    jobStatus: runtime.jobStatus,
    previewStatus: runtime.previewStatus,
    sourceIntegrityOk: meta.source_integrity_ok === true,
    meaningfulSourceFileCount:
      typeof meta.meaningful_source_file_count === "number"
        ? meta.meaningful_source_file_count
        : undefined,
  });

  const repairWouldShowIncomplete =
    isTrueIncompleteFiles({
      appFilesCount: files.length,
      packageJsonExists,
      entrypointExists,
      sourceIntegrityOk: meta.source_integrity_ok === true,
      meaningfulSourceFileCount:
        typeof meta.meaningful_source_file_count === "number"
          ? meta.meaningful_source_file_count
          : undefined,
    }) &&
    !(runtime.jobStatus === "failed" || runtime.previewStatus === "failed");

  const latest = meta.latest_preview_failure as Record<string, unknown> | undefined;
  const sessionId =
    typeof meta.preview_session_id === "string"
      ? meta.preview_session_id
      : typeof meta.last_preview_session_id === "string"
        ? meta.last_preview_session_id
        : null;

  return {
    project_id: projectId,
    preview_session_id: sessionId,
    preview_build_job_id:
      typeof meta.preview_job_id === "string"
        ? meta.preview_job_id
        : runtime.jobId,
    failure_kind: classification.failure_kind,
    failure_stage: classification.failure_stage,
    failure_message: classification.failure_message,
    build_logs_tail: classification.build_logs_tail,
    npm_error: classification.npm_error,
    vite_error: classification.vite_error,
    typescript_error: classification.typescript_error,
    missing_imports: classification.missing_imports,
    missing_files: classification.missing_files,
    invalid_exports: classification.invalid_exports,
    unsupported_packages: classification.unsupported_packages,
    app_files_count: files.length,
    routes_count: routes.length,
    package_json_exists: packageJsonExists,
    entrypoint_exists: entrypointExists,
    preview_artifact_exists: previewArtifactExists,
    why_ui_says_generated_files_incomplete: whyUiSaysGeneratedFilesIncomplete({
      classification,
      appFilesCount: files.length,
      repairShowsIncompleteSource: repairWouldShowIncomplete,
    }),
    classification,
    generation_quality_score:
      typeof meta.generation_quality_score === "number" ? meta.generation_quality_score : null,
    source_integrity_score:
      typeof meta.source_integrity_score === "number" ? meta.source_integrity_score : null,
    preview_build_status:
      typeof meta.preview_build_status === "string"
        ? meta.preview_build_status
        : (proj.build_status ?? null),
  };
}
