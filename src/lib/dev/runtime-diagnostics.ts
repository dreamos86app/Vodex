import { dreamosLog } from "@/lib/diagnostics/dreamos-logger";
import { sanitizeDiagnosticMetadata } from "@/lib/diagnostics/truncate-large-diagnostic-string";
import {
  isAuthRelatedDiagnosticMessage,
  sanitizeDiagnosticDetail,
  sanitizeDiagnosticMessage,
} from "@/lib/diagnostics/sanitize-diagnostic-message";

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
  const safe = sanitizeDiagnosticDetail(detail);
  void import("@/lib/dev/owner-incident-store").then(({ pushOwnerIncident }) => {
    pushOwnerIncident({
      kind: event === "error_boundary" ? "render" : "diagnostic",
      title: event.replace(/_/g, " "),
      message: safe ? JSON.stringify(safe).slice(0, 2000) : undefined,
      meta: safe,
    });
  });
}

function isStaleAuthStreamFailure(entry: RuntimeDiagnosticEntry): boolean {
  if (entry.event !== "stream_failed") return false;
  const message =
    typeof entry.detail?.message === "string"
      ? entry.detail.message
      : JSON.stringify(entry.detail ?? "");
  return isAuthRelatedDiagnosticMessage(message);
}

/** Drop superseded auth stream failures once providers are healthy again. */
export function purgeStaleAuthStreamDiagnostics(): number {
  if (typeof sessionStorage === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const prev: RuntimeDiagnosticEntry[] = raw ? (JSON.parse(raw) as RuntimeDiagnosticEntry[]) : [];
    const next = prev.filter((entry) => !isStaleAuthStreamFailure(entry));
    if (next.length !== prev.length) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    return prev.length - next.length;
  } catch {
    return 0;
  }
}

function migrateDiagnosticEntry(entry: RuntimeDiagnosticEntry): RuntimeDiagnosticEntry {
  const detail = entry.detail ? sanitizeDiagnosticDetail(sanitizeDiagnosticMetadata(entry.detail)) : undefined;
  return detail === entry.detail ? entry : { ...entry, detail };
}

export function pushRuntimeDiagnostic(
  event: RuntimeDiagnosticEvent,
  detail?: Record<string, unknown>,
): void {
  let safeDetail = detail ? sanitizeDiagnosticMetadata(detail) : undefined;
  safeDetail = sanitizeDiagnosticDetail(safeDetail);
  if (event === "stream_finished" || event === "preflight_ok") {
    purgeStaleAuthStreamDiagnostics();
  }
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
    const rows = raw ? (JSON.parse(raw) as RuntimeDiagnosticEntry[]) : [];
    return rows.map(migrateDiagnosticEntry);
  } catch {
    return [];
  }
}

export function clearRuntimeDiagnostics(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Owner console: verify providers, then drop stale auth stream failures from storage. */
export async function reconcileRuntimeDiagnosticsWithProviderHealth(): Promise<{
  openaiAvailable: boolean;
  purged: number;
}> {
  if (typeof window === "undefined") return { openaiAvailable: false, purged: 0 };
  try {
    const res = await fetch("/api/ai/provider-status", { credentials: "include", cache: "no-store" });
    if (!res.ok) return { openaiAvailable: false, purged: 0 };
    const body = (await res.json()) as { providers?: Record<string, string> };
    const openaiAvailable = body.providers?.openai === "available";
    const purged = openaiAvailable ? purgeStaleAuthStreamDiagnostics() : 0;
    if (openaiAvailable && purged > 0) {
      pushRuntimeDiagnostic("preflight_ok", { source: "provider_status_reconcile", purged });
    }
    return { openaiAvailable, purged };
  } catch {
    return { openaiAvailable: false, purged: 0 };
  }
}
