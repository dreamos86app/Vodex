/**
 * P1.3.17 — Canonical build trace artifact per job (debug + metadata).
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import type { GenericScaffoldDetection } from "@/lib/build/generic-scaffold-detector";
import type { MeaningfulUiQualityReport } from "@/lib/build/meaningful-ui-quality";

export type BuildTraceArtifact = {
  build_job_id: string;
  project_id: string;
  prompt: string;
  selected_model_label: string | null;
  actual_model_id: string | null;
  provider: string | null;
  token_budget_requested: number | null;
  max_output_tokens: number | null;
  model_call_started_at: string | null;
  model_call_completed_at: string | null;
  model_duration_ms: number | null;
  raw_model_response_size_chars: number | null;
  parsed_file_count: number;
  parsed_route_count: number;
  parsed_component_count: number;
  scaffold_file_count: number;
  model_file_count: number;
  fallback_used: boolean;
  fallback_reason: string | null;
  generic_scaffold_detected: boolean;
  generic_scaffold_reasons: string[];
  continuation_attempts: number;
  continuation_reasons: string[];
  continuation_outputs: number[];
  quality_scores_by_attempt: number[];
  meaningful_routes_by_attempt: number[];
  weak_files_by_attempt: string[][];
  logo_generation_attempted: boolean;
  logo_generation_status: string | null;
  logo_failure_reason: string | null;
  import_graph_status: "pass" | "repaired" | "fail";
  missing_imports: string[];
  preview_start_attempted: boolean;
  preview_status: string | null;
  stream_health?: {
    max_silent_gap_ms: number;
    events_per_minute: number;
    file_events_count: number;
    narration_events_count: number;
  };
  recorded_at: string;
};

export type BuildTraceCollector = {
  artifact: BuildTraceArtifact;
  noteContinuation: (input: {
    reason: string;
    fileCount: number;
    qualityScore: number;
    meaningfulRoutes: number;
    weakFiles: string[];
  }) => void;
  noteModelCall: (input: {
    startedAt: string;
    completedAt: string;
    responseChars: number;
    maxOutputTokens: number;
    modelId: string;
    provider: string | null;
  }) => void;
};

export function createBuildTraceCollector(input: {
  buildJobId: string;
  projectId: string;
  prompt: string;
  selectedModelLabel?: string | null;
}): BuildTraceCollector {
  const artifact: BuildTraceArtifact = {
    build_job_id: input.buildJobId,
    project_id: input.projectId,
    prompt: input.prompt,
    selected_model_label: input.selectedModelLabel ?? null,
    actual_model_id: null,
    provider: null,
    token_budget_requested: null,
    max_output_tokens: null,
    model_call_started_at: null,
    model_call_completed_at: null,
    model_duration_ms: null,
    raw_model_response_size_chars: null,
    parsed_file_count: 0,
    parsed_route_count: 0,
    parsed_component_count: 0,
    scaffold_file_count: 0,
    model_file_count: 0,
    fallback_used: false,
    fallback_reason: null,
    generic_scaffold_detected: false,
    generic_scaffold_reasons: [],
    continuation_attempts: 0,
    continuation_reasons: [],
    continuation_outputs: [],
    quality_scores_by_attempt: [],
    meaningful_routes_by_attempt: [],
    weak_files_by_attempt: [],
    logo_generation_attempted: false,
    logo_generation_status: null,
    logo_failure_reason: null,
    import_graph_status: "pass",
    missing_imports: [],
    preview_start_attempted: false,
    preview_status: null,
    recorded_at: new Date().toISOString(),
  };

  return {
    artifact,
    noteContinuation({ reason, fileCount, qualityScore, meaningfulRoutes, weakFiles }) {
      artifact.continuation_attempts += 1;
      artifact.continuation_reasons.push(reason);
      artifact.continuation_outputs.push(fileCount);
      artifact.quality_scores_by_attempt.push(qualityScore);
      artifact.meaningful_routes_by_attempt.push(meaningfulRoutes);
      artifact.weak_files_by_attempt.push(weakFiles);
    },
    noteModelCall({ startedAt, completedAt, responseChars, maxOutputTokens, modelId, provider }) {
      artifact.model_call_started_at = startedAt;
      artifact.model_call_completed_at = completedAt;
      artifact.model_duration_ms = Math.max(
        0,
        Date.parse(completedAt) - Date.parse(startedAt),
      );
      artifact.raw_model_response_size_chars = responseChars;
      artifact.max_output_tokens = maxOutputTokens;
      artifact.actual_model_id = modelId;
      artifact.provider = provider;
    },
  };
}

export function finalizeBuildTraceArtifact(input: {
  collector: BuildTraceCollector;
  parsedFileCount: number;
  parsedRouteCount: number;
  parsedComponentCount: number;
  modelFileCount: number;
  scaffoldFileCount: number;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  genericScaffold: GenericScaffoldDetection;
  meaningfulQuality: MeaningfulUiQualityReport;
  logoAttempted: boolean;
  logoStatus: string | null;
  logoFailureReason: string | null;
  importGraphStatus: BuildTraceArtifact["import_graph_status"];
  missingImports: string[];
  previewStartAttempted: boolean;
  previewStatus: string | null;
  streamHealth?: BuildTraceArtifact["stream_health"];
}): BuildTraceArtifact {
  const a = input.collector.artifact;
  a.parsed_file_count = input.parsedFileCount;
  a.parsed_route_count = input.parsedRouteCount;
  a.parsed_component_count = input.parsedComponentCount;
  a.model_file_count = input.modelFileCount;
  a.scaffold_file_count = input.scaffoldFileCount;
  a.fallback_used = input.fallbackUsed;
  a.fallback_reason = input.fallbackReason;
  a.generic_scaffold_detected = input.genericScaffold.isGeneric;
  a.generic_scaffold_reasons = input.genericScaffold.reasons;
  a.logo_generation_attempted = input.logoAttempted;
  a.logo_generation_status = input.logoStatus;
  a.logo_failure_reason = input.logoFailureReason;
  a.import_graph_status = input.importGraphStatus;
  a.missing_imports = input.missingImports;
  a.preview_start_attempted = input.previewStartAttempted;
  a.preview_status = input.previewStatus;
  a.stream_health = input.streamHealth;
  a.recorded_at = new Date().toISOString();
  if (!a.quality_scores_by_attempt.length) {
    a.quality_scores_by_attempt.push(input.meaningfulQuality.final_quality_score);
    a.meaningful_routes_by_attempt.push(input.meaningfulQuality.meaningful_routes);
  }
  return a;
}

export function writeBuildTraceArtifactFile(artifact: BuildTraceArtifact): string {
  const dir = join(process.cwd(), "artifacts", "build-traces");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${artifact.build_job_id}.json`);
  writeFileSync(filePath, JSON.stringify(artifact, null, 2), "utf8");
  return filePath;
}

export async function persistBuildTraceArtifact(
  writer: SupabaseClient<Database>,
  buildJobId: string,
  artifact: BuildTraceArtifact,
): Promise<void> {
  try {
    writeBuildTraceArtifactFile(artifact);
  } catch {
    /* dev artifact optional */
  }

  const { data: row } = await writer
    .from("build_jobs")
    .select("meta")
    .eq("id", buildJobId)
    .maybeSingle();
  const prev =
    row?.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
      ? (row.meta as Record<string, unknown>)
      : {};
  const next = { ...prev, build_trace: artifact as unknown as Json };
  await writer.from("build_jobs").update({ meta: next as Json } as never).eq("id", buildJobId);
}

export function computeStreamHealthFromEvents(
  events: Array<{ at?: string; type?: string; meta?: Record<string, unknown> }>,
  startedAtMs: number,
): BuildTraceArtifact["stream_health"] {
  const times = events
    .map((e) => (e.at ? Date.parse(e.at) : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 1; i < times.length; i++) {
    maxGap = Math.max(maxGap, times[i]! - times[i - 1]!);
  }
  const durationMin = Math.max(1 / 60, (Date.now() - startedAtMs) / 60_000);
  const fileEvents = events.filter(
    (e) =>
      e.type === "writing" ||
      e.type === "editing" ||
      e.meta?.extraction_stream === true,
  ).length;
  const narration = events.filter(
    (e) => e.meta?.streamCategory === "assistant_message" || e.type === "thinking",
  ).length;
  return {
    max_silent_gap_ms: maxGap,
    events_per_minute: Math.round(events.length / durationMin),
    file_events_count: fileEvents,
    narration_events_count: narration,
  };
}
