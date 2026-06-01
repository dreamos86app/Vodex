import { dreamosLog } from "@/lib/diagnostics/dreamos-logger";
import { sanitizeDiagnosticMetadata } from "@/lib/diagnostics/truncate-large-diagnostic-string";

/** Owner-only in-app runtime event log (sessionStorage, max 50). */

export type RuntimeDiagnosticEvent =
  | "prompt_submit_started"
  | "prompt_submit_skipped_duplicate"
  | "prompt_submit_consumed_once"
  | "intent_classified"
  | "preflight_ok"
  | "preflight_failed"
  | "stream_started"
  | "stream_finished"
  | "stream_failed"
  | "conversation_created"
  | "conversation_create_failed"
  | "profile_ensure_started"
  | "profile_ensure_failed"
  | "profile_ensure_succeeded"
  | "provider_call_blocked"
  | "provider_call_started"
  | "provider_call_failed"
  | "app_identity_started"
  | "app_identity_failed"
  | "app_identity_succeeded"
  | "icon_svg_started"
  | "icon_svg_failed"
  | "icon_svg_succeeded"
  | "project_metadata_saved"
  | "project_metadata_failed"
  | "build_job_created"
  | "build_step_started"
  | "build_step_completed"
  | "files_saved"
  | "files_persist_failed"
  | "preview_generated"
  | "preview_compile_failed"
  | "charge_started"
  | "charge_success"
  | "charge_failed"
  | "charge_tokens_missing"
  | "schema_warning"
  | "schema_check_failed"
  | "schema_check_contradiction"
  | "rpc_postgrest_missing"
  | "rpc_pgproc_exists_but_postgrest_missing"
  | "credit_charge_blocked"
  | "provider_failed"
  | "provider_fallback"
  | "build_failed"
  | "app_identity_failed"
  | "icon_generation_failed"
  | "duplicate_prompt_deduped"
  | "publish_readiness"
  | "queue_add"
  | "queue_drain"
  | "error_boundary"
  | "handoff_consumed"
  | "handoff_failed"
  | "project_reused"
  | "project_created"
  | "project_create_deferred_plan_first";

export type RuntimeDiagnosticEntry = {
  event: RuntimeDiagnosticEvent;
  at: string;
  detail?: Record<string, unknown>;
};

const STORAGE_KEY = "vodex.runtimeDiagnostics";
const MAX = 100;

const EVENT_CATEGORY: Partial<Record<RuntimeDiagnosticEvent, import("@/lib/diagnostics/dreamos-logger").DreamosLogCategory>> = {
  charge_failed: "credit",
  charge_tokens_missing: "credit",
  charge_success: "credit",
  charge_started: "credit",
  build_step_started: "build",
  build_step_completed: "build",
  build_job_created: "build",
  prompt_submit_skipped_duplicate: "duplicate_prompt",
  stream_failed: "api_error",
  preflight_failed: "api_error",
  files_persist_failed: "api_error",
  error_boundary: "frontend_error",
  schema_warning: "supabase",
  schema_check_failed: "supabase",
  schema_check_contradiction: "supabase",
  rpc_postgrest_missing: "supabase",
  rpc_pgproc_exists_but_postgrest_missing: "supabase",
  credit_charge_blocked: "credit",
  provider_failed: "api_error",
  provider_fallback: "api_error",
  build_failed: "build",
  app_identity_failed: "build",
  icon_generation_failed: "build",
  duplicate_prompt_deduped: "duplicate_prompt",
  publish_readiness: "publish",
};

function mirrorFailedDiagnosticToOwner(
  event: RuntimeDiagnosticEvent,
  detail?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (!event.includes("failed") && event !== "error_boundary") return;
  void import("@/lib/dev/owner-incident-store").then(({ pushOwnerIncident }) => {
    pushOwnerIncident({
      kind: event === "error_boundary" ? "render" : "diagnostic",
      title: event.replace(/_/g, " "),
      message: detail ? JSON.stringify(detail).slice(0, 2000) : undefined,
      meta: detail,
    });
  });
}

export function pushRuntimeDiagnostic(
  event: RuntimeDiagnosticEvent,
  detail?: Record<string, unknown>,
): void {
  const safeDetail = detail ? sanitizeDiagnosticMetadata(detail) : undefined;
  dreamosLog({
    source: "client",
    category: EVENT_CATEGORY[event] ?? "general",
    severity:
      event.includes("failed") || event === "error_boundary" || event === "charge_tokens_missing"
        ? "warn"
        : "info",
    action: event,
    message: event.replace(/_/g, " "),
    metadata: safeDetail,
    projectId: typeof safeDetail?.projectId === "string" ? safeDetail.projectId : null,
    conversationId:
      typeof safeDetail?.conversationId === "string" ? safeDetail.conversationId : null,
    buildId: typeof safeDetail?.buildJobId === "string" ? safeDetail.buildJobId : null,
  });

  mirrorFailedDiagnosticToOwner(event, safeDetail);

  if (typeof sessionStorage === "undefined") return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const prev: RuntimeDiagnosticEntry[] = raw ? (JSON.parse(raw) as RuntimeDiagnosticEntry[]) : [];
    const next: RuntimeDiagnosticEntry[] = [
      { event, at: new Date().toISOString(), detail: safeDetail },
      ...prev,
    ].slice(0, MAX);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

export function readRuntimeDiagnostics(): RuntimeDiagnosticEntry[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RuntimeDiagnosticEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearRuntimeDiagnostics(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
