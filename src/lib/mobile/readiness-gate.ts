import type { SupabaseClient } from "@supabase/supabase-js";
import {
  readMobileConfigFromMetadata,
  saveMobileConfigFallback,
} from "@/lib/mobile/mobile-config-fallback";

export const MOBILE_GATE_META_KEYS = [
  "readiness_gate_passed_at",
  "last_readiness_blocker_count",
  "last_eligibility_critical_count",
] as const;

export type MobileGateState = {
  passed: boolean;
  passedAt: string | null;
  criticalCount: number;
  message: string;
  code: "readiness_gate" | "no_config" | "stale_scan";
};

function gateFromMeta(meta: Record<string, unknown> | null): MobileGateState {
  const passedAt =
    typeof meta?.readiness_gate_passed_at === "string" ? meta.readiness_gate_passed_at : null;
  const criticalCount =
    typeof meta?.last_eligibility_critical_count === "number"
      ? meta.last_eligibility_critical_count
      : Number(meta?.last_readiness_blocker_count ?? 0);

  if (!passedAt) {
    return {
      passed: false,
      passedAt: null,
      criticalCount,
      message: "Run the full app eligibility scan (Step 1) before packaging.",
      code: "readiness_gate",
    };
  }

  if (criticalCount > 0) {
    return {
      passed: false,
      passedAt,
      criticalCount,
      message: "Eligibility scan has critical blockers — fix them and re-run the scan.",
      code: "readiness_gate",
    };
  }

  return {
    passed: true,
    passedAt,
    criticalCount: 0,
    message: "ok",
    code: "readiness_gate",
  };
}

/** Strip client attempts to spoof gate fields via PATCH meta. */
export function sanitizeMobileConfigPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const next = { ...patch };
  if (next.meta && typeof next.meta === "object" && !Array.isArray(next.meta)) {
    const meta = { ...(next.meta as Record<string, unknown>) };
    for (const key of MOBILE_GATE_META_KEYS) {
      delete meta[key];
    }
    next.meta = meta;
  }
  return next;
}

export async function loadMobileGateState(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
): Promise<MobileGateState> {
  const { data: config } = await supabase
    .from("mobile_app_configs" as never)
    .select("meta")
    .eq("project_id", projectId)
    .maybeSingle();

  if (config) {
    const meta =
      (config as { meta?: unknown }).meta &&
      typeof (config as { meta?: unknown }).meta === "object" &&
      !Array.isArray((config as { meta?: unknown }).meta)
        ? ((config as { meta?: unknown }).meta as Record<string, unknown>)
        : null;
    return gateFromMeta(meta);
  }

  const { data: project } = await supabase
    .from("projects")
    .select("metadata")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();

  const metaConfig = readMobileConfigFromMetadata(project?.metadata);
  const meta =
    metaConfig?.meta && typeof metaConfig.meta === "object" && !Array.isArray(metaConfig.meta)
      ? (metaConfig.meta as Record<string, unknown>)
      : null;

  return gateFromMeta(meta);
}

export type AssertMobileGateResult =
  | { ok: true; state: MobileGateState }
  | { ok: false; state: MobileGateState; status: 403 };

/** Server-side enforcement — must pass before mobile build / Android wrap. */
export async function assertMobileReadinessGate(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
): Promise<AssertMobileGateResult> {
  const state = await loadMobileGateState(supabase, projectId, userId);
  if (!state.passed) {
    return { ok: false, state, status: 403 };
  }
  return { ok: true, state };
}

export async function persistMobileGateMeta(
  writer: SupabaseClient,
  projectId: string,
  userId: string,
  input: {
    passed: boolean;
    criticalCount: number;
    blockerCount: number;
  },
): Promise<void> {
  const patch = {
    meta: {
      readiness_gate_passed_at: input.passed ? new Date().toISOString() : null,
      last_readiness_blocker_count: input.blockerCount,
      last_eligibility_critical_count: input.criticalCount,
    },
  };

  const { data: existing } = await writer
    .from("mobile_app_configs" as never)
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  if ((existing as { id?: string } | null)?.id) {
    const { data: row } = await writer
      .from("mobile_app_configs" as never)
      .select("meta")
      .eq("project_id", projectId)
      .maybeSingle();
    const prevMeta =
      row &&
      (row as { meta?: unknown }).meta &&
      typeof (row as { meta?: unknown }).meta === "object" &&
      !Array.isArray((row as { meta?: unknown }).meta)
        ? ((row as { meta?: unknown }).meta as Record<string, unknown>)
        : {};
    await writer
      .from("mobile_app_configs" as never)
      .update({
        meta: { ...prevMeta, ...patch.meta },
      } as never)
      .eq("project_id", projectId);
    return;
  }

  await saveMobileConfigFallback(writer, projectId, userId, patch);
}
