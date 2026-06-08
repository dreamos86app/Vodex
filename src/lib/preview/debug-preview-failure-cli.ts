/**
 * CLI-safe preview failure debug loader — no Next.js or server-only imports.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectPreviewRoutesFromFiles } from "@/lib/preview/detect-preview-routes";
import {
  classifyPreviewBuildFailure,
  isTrueIncompleteFiles,
  type PreviewFailureClassification,
} from "@/lib/preview/preview-failure-classifier";
import { normalizePreviewBuildLogs } from "@/lib/preview/preview-build-log-normalizer";
import {
  detectTodoStubMatches,
  type TodoStubMatch,
} from "@/lib/build/todo-stub-detector";

export type PreviewFailureCliDebugObject = {
  project_id: string;
  project_name: string | null;
  app_files_count: number;
  package_json_exists: boolean;
  route_count: number;
  latest_preview_session_id: string | null;
  latest_preview_build_job_id: string | null;
  preview_status: string | null;
  preview_renderable: boolean;
  failure_kind: string;
  failure_stage: string;
  failure_message: string;
  normalized_error: string | null;
  build_logs_tail: string[];
  repairable: boolean;
  why_ui_shows_failed: string;
  entrypoint_exists: boolean;
  preview_artifact_exists: boolean;
  generation_quality_score: number | null;
  source_integrity_score: number | null;
  preview_build_status: string | null;
  todo_stub_matches: Array<{
    file_path: string;
    detector: string;
    snippet: string;
    blocking: boolean;
  }>;
  classification: PreviewFailureClassification;
};

type PreviewBuildJobRow = {
  id: string;
  status: string;
  build_logs: string | null;
  logs: string | null;
  artifact_path: string | null;
  blocked_reason: string | null;
  preview_renderable: boolean | null;
  diagnostics: Record<string, unknown> | null;
};

type PreviewSessionRow = {
  id: string;
  status: string;
  error: string | null;
};

function metaRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function readErrorCode(diag: Record<string, unknown> | null): string | null {
  if (!diag) return null;
  if (typeof diag.errorCode === "string") return diag.errorCode;
  const bm = diag.previewBuildMeta;
  if (bm && typeof bm === "object" && typeof (bm as { errorCode?: string }).errorCode === "string") {
    return (bm as { errorCode: string }).errorCode;
  }
  return null;
}

function readUserMessage(diag: Record<string, unknown> | null): string | null {
  if (!diag) return null;
  if (typeof diag.userMessage === "string") return diag.userMessage;
  const bm = diag.previewBuildMeta;
  if (bm && typeof bm === "object" && typeof (bm as { userMessage?: string }).userMessage === "string") {
    return (bm as { userMessage: string }).userMessage;
  }
  return null;
}

export function whyUiShowsFailed(input: {
  classification: PreviewFailureClassification;
  appFilesCount: number;
  previewBuildFailed: boolean;
  repairWouldShowIncomplete: boolean;
}): string {
  if (input.classification.failure_kind === "true_incomplete_files") {
    return "UI shows incomplete files because source genuinely fails integrity checks.";
  }
  if (input.repairWouldShowIncomplete && input.appFilesCount >= 25) {
    return `UI may have shown "Generated files are incomplete" — misclassified; ${input.appFilesCount} files exist. Real kind: ${input.classification.failure_kind}.`;
  }
  if (input.previewBuildFailed) {
    return `UI should show preview build failed (${input.classification.human_title}): ${input.classification.failure_message}`;
  }
  return `Preview not renderable — ${input.classification.failure_kind}: ${input.classification.failure_message}`;
}

export async function loadPreviewFailureCliDebug(
  supabase: SupabaseClient,
  projectId: string,
): Promise<PreviewFailureCliDebugObject | null> {
  const { data: proj } = await supabase
    .from("projects")
    .select("id, name, app_name, metadata, build_status, preview_url")
    .eq("id", projectId)
    .maybeSingle();

  if (!proj) return null;

  const meta = metaRecord(proj.metadata);

  const { count: fileCount } = await supabase
    .from("app_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { data: fileRows } = await supabase
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId)
    .limit(500);

  const paths = (fileRows ?? []).map((r) => r.path ?? "").filter(Boolean);
  const filesWithContent = (fileRows ?? []).map((r) => ({
    path: r.path ?? "",
    content: r.content ?? "",
  }));
  const filesForRoutes = filesWithContent;
  const routes = detectPreviewRoutesFromFiles(filesForRoutes);

  const packageJsonExists = paths.includes("package.json");
  const entrypointExists = paths.some(
    (p) => /^app\/(page|layout)\.(tsx|jsx)$/i.test(p) || p === "index.html",
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: jobRow } = (await db
    .from("preview_build_jobs")
    .select(
      "id, status, build_logs, logs, artifact_path, blocked_reason, preview_renderable, diagnostics",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: PreviewBuildJobRow | null };

  const sessionIdFromMeta =
    typeof meta.last_preview_session_id === "string"
      ? meta.last_preview_session_id
      : typeof meta.preview_session_id === "string"
        ? meta.preview_session_id
        : null;

  let sessionRow: PreviewSessionRow | null = null;
  if (sessionIdFromMeta) {
    const { data } = (await db
      .from("preview_sessions")
      .select("id, status, error")
      .eq("id", sessionIdFromMeta)
      .eq("project_id", projectId)
      .maybeSingle()) as { data: PreviewSessionRow | null };
    sessionRow = data;
  }
  if (!sessionRow) {
    const { data } = (await db
      .from("preview_sessions")
      .select("id, status, error")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: PreviewSessionRow | null };
    sessionRow = data;
  }

  const diag = jobRow?.diagnostics ?? null;
  const buildLogs =
    (typeof jobRow?.logs === "string" ? jobRow.logs : null) ??
    (typeof jobRow?.build_logs === "string" ? jobRow.build_logs : null) ??
    (typeof diag?.buildLogs === "string" ? diag.buildLogs : null);

  const errorCode = readErrorCode(diag);
  const userMessage =
    readUserMessage(diag) ??
    sessionRow?.error ??
    (typeof meta.preview_error === "string" ? meta.preview_error : null) ??
    (typeof meta.last_preview_error === "string" ? meta.last_preview_error : null);

  const blockedReason =
    jobRow?.blocked_reason ??
    (typeof diag?.blockedReason === "string" ? diag.blockedReason : null) ??
    (typeof meta.preview_blocked_reason === "string" ? meta.preview_blocked_reason : null);

  const jobStatus = jobRow?.status ?? null;
  const previewStatus =
    sessionRow?.status ??
    (typeof meta.preview_status === "string" ? meta.preview_status : null);

  const previewArtifactExists = Boolean(
    jobRow?.artifact_path ?? (typeof meta.preview_artifact_path === "string" ? meta.preview_artifact_path : null),
  );

  const previewRenderable = Boolean(
    meta.preview_renderable === true ||
      meta.preview_ready === true ||
      (jobRow?.status === "succeeded" && jobRow.preview_renderable === true),
  );

  const storedFailure = meta.latest_preview_failure;
  let classification: PreviewFailureClassification;

  if (
    storedFailure &&
    typeof storedFailure === "object" &&
    typeof (storedFailure as { failure_kind?: string }).failure_kind === "string"
  ) {
    classification = storedFailure as PreviewFailureClassification;
  } else {
    classification = classifyPreviewBuildFailure({
      appFilesCount: fileCount ?? paths.length,
      routesCount: routes.length,
      packageJsonExists,
      entrypointExists,
      previewArtifactExists,
      buildLogs,
      errorCode,
      blockedReason,
      userMessage,
      jobStatus,
      previewStatus,
      previewBuildJobId: jobRow?.id ?? null,
      sourceIntegrityOk: meta.source_integrity_ok === true,
      meaningfulSourceFileCount:
        typeof meta.meaningful_source_file_count === "number"
          ? meta.meaningful_source_file_count
          : undefined,
    });
  }

  const metaMatches = Array.isArray(meta.todo_stub_matches)
    ? (meta.todo_stub_matches as TodoStubMatch[])
    : [];
  const liveMatches =
    filesWithContent.length > 0 ? detectTodoStubMatches(filesWithContent).matches : [];
  const todoStubMatches = (metaMatches.length ? metaMatches : liveMatches).map((m) => ({
    file_path: m.file_path,
    detector: m.detector,
    snippet: m.snippet,
    blocking: m.blocking,
  }));

  const normalized = normalizePreviewBuildLogs(buildLogs);
  const normalizedError =
    classification.typescript_error ??
    classification.vite_error ??
    classification.npm_error ??
    normalized.typescript_error ??
    normalized.vite_error ??
    normalized.npm_error ??
    classification.failure_message;

  const previewBuildFailed =
    jobStatus === "failed" ||
    previewStatus === "failed" ||
    meta.preview_build_status === "failed" ||
    meta.files_ready_preview_failed === true ||
    (proj.build_status ?? "").toLowerCase() === "preview_failed";

  const repairWouldShowIncomplete =
    isTrueIncompleteFiles({
      appFilesCount: fileCount ?? paths.length,
      packageJsonExists,
      entrypointExists,
      sourceIntegrityOk: meta.source_integrity_ok === true,
      meaningfulSourceFileCount:
        typeof meta.meaningful_source_file_count === "number"
          ? meta.meaningful_source_file_count
          : undefined,
    }) && !previewBuildFailed;

  const projectName =
    (typeof proj.app_name === "string" && proj.app_name) ||
    (typeof proj.name === "string" && proj.name) ||
    null;

  return {
    project_id: projectId,
    project_name: projectName,
    app_files_count: fileCount ?? paths.length,
    package_json_exists: packageJsonExists,
    route_count: routes.length,
    latest_preview_session_id: sessionRow?.id ?? sessionIdFromMeta,
    latest_preview_build_job_id:
      jobRow?.id ??
      (typeof meta.last_preview_build_job_id === "string"
        ? meta.last_preview_build_job_id
        : typeof meta.preview_job_id === "string"
          ? meta.preview_job_id
          : null),
    preview_status: previewStatus,
    preview_renderable: previewRenderable,
    failure_kind: classification.failure_kind,
    failure_stage: classification.failure_stage,
    failure_message: classification.failure_message,
    normalized_error: normalizedError,
    build_logs_tail: classification.build_logs_tail.length
      ? classification.build_logs_tail
      : normalized.build_logs_tail,
    repairable: classification.auto_repair_eligible,
    why_ui_shows_failed: whyUiShowsFailed({
      classification,
      appFilesCount: fileCount ?? paths.length,
      previewBuildFailed,
      repairWouldShowIncomplete,
    }),
    entrypoint_exists: entrypointExists,
    preview_artifact_exists: previewArtifactExists,
    generation_quality_score:
      typeof meta.generation_quality_score === "number" ? meta.generation_quality_score : null,
    source_integrity_score:
      typeof meta.source_integrity_score === "number" ? meta.source_integrity_score : null,
    preview_build_status:
      typeof meta.preview_build_status === "string"
        ? meta.preview_build_status
        : (proj.build_status ?? null),
    todo_stub_matches: todoStubMatches,
    classification,
  };
}
