/**
 * P1.3.15 — Canonical build stage IDs for honest orchestration.
 * Each stage maps to one real async operation; never mark done before it resolves.
 */

export const CANONICAL_BUILD_STAGES = [
  "receive_prompt",
  "classify_intent",
  "generate_app_name",
  "generate_app_icon",
  "generate_blueprint",
  "generate_data_model",
  "generate_routes",
  "generate_design_system",
  "generate_core_layout",
  "generate_pages",
  "generate_components",
  "generate_mock_data",
  "wire_navigation",
  "validate_imports",
  "validate_routes",
  "validate_ui_quality",
  "persist_files",
  "start_preview",
  "preview_ready",
  "preview_failed",
] as const;

export type CanonicalBuildStage = (typeof CANONICAL_BUILD_STAGES)[number];

export type BuildStageStatus = "queued" | "running" | "done" | "warning" | "failed";

export type BuildStageEventMetadata = {
  stage: CanonicalBuildStage;
  status: BuildStageStatus;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  model_used?: string;
  provider_used?: string;
  actual_operation_id?: string;
  honest: true;
  stream_mode?: "model_stream" | "extraction_stream";
};

export const STAGE_USER_LABELS: Record<CanonicalBuildStage, string> = {
  receive_prompt: "Received your prompt",
  classify_intent: "Understanding what to build",
  generate_app_name: "Naming your app",
  generate_app_icon: "Designing app icon",
  generate_blueprint: "Creating the app blueprint",
  generate_data_model: "Designing data model",
  generate_routes: "Mapping routes and screens",
  generate_design_system: "Creating design system",
  generate_core_layout: "Building app shell and layout",
  generate_pages: "Writing pages",
  generate_components: "Building components",
  generate_mock_data: "Adding realistic sample data",
  wire_navigation: "Wiring navigation",
  validate_imports: "Checking imports",
  validate_routes: "Validating routes",
  validate_ui_quality: "Checking interface quality",
  persist_files: "Saving files",
  start_preview: "Starting preview",
  preview_ready: "Preview ready",
  preview_failed: "Preview needs attention",
};

/** Heartbeat copy while a long stage is still running. */
export const STAGE_HEARTBEAT_MESSAGES: Partial<Record<CanonicalBuildStage, string[]>> = {
  generate_pages: [
    "Still writing pages…",
    "Still building screens…",
    "Still generating UI…",
  ],
  generate_components: [
    "Still building components…",
    "Still wiring UI pieces…",
  ],
  generate_core_layout: ["Still setting up the app shell…"],
  validate_ui_quality: ["Still checking interface quality…"],
  persist_files: ["Still saving files…"],
  start_preview: ["Still preparing preview…"],
};

export function heartbeatMessageForStage(
  stage: CanonicalBuildStage,
  tick: number,
): string {
  const pool = STAGE_HEARTBEAT_MESSAGES[stage];
  if (!pool?.length) return `Still working on ${STAGE_USER_LABELS[stage].toLowerCase()}…`;
  return pool[tick % pool.length]!;
}
