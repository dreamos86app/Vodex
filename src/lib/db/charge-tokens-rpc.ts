import type { Json } from "@/lib/supabase/types";

/** Canonical named-parameter order for charge_tokens (PostgREST / app). */
export const CANONICAL_CHARGE_TOKENS_ARG_NAMES = [
  "p_amount",
  "p_conversation_id",
  "p_idempotency_key",
  "p_metadata",
  "p_project_id",
  "p_reason",
  "p_user_id",
] as const;

/** Live DB signature (p_user_id first). PostgREST may list params alphabetically in errors. */
export const CANONICAL_CHARGE_TOKENS_PG_ARGS =
  "p_user_id uuid, p_amount integer, p_reason text, p_idempotency_key text, p_metadata jsonb, p_project_id uuid, p_conversation_id uuid";

export const CANONICAL_ENSURE_USER_PROFILE_PG_ARGS = "p_user_id uuid, p_email text";

export type ChargeTokensRpcPayload = {
  p_amount: number;
  p_conversation_id: string | null;
  p_idempotency_key: string;
  p_metadata: Json | Record<string, unknown>;
  p_project_id: string | null;
  p_reason: string;
  p_user_id: string;
};

export type PgProcSignature = {
  args: string;
  returns: string;
  arg_names: string[];
};

export const CHARGE_TOKENS_PROBE_USER_ID = "00000000-0000-0000-0000-000000000000";

export const CHARGE_TOKENS_STALE_POSTGREST_MESSAGE =
  "RPC exists in Postgres but PostgREST cannot call it yet. This is usually stale schema cache, wrong signature, permissions, or old deployment. Use Debug RPC JSON.";

export const CHARGE_TOKENS_MISSING_PG_MESSAGE =
  "charge_tokens is not installed in Postgres (pg_proc has no rows). Run Copy SQL fix and execute the entire patch in Supabase SQL Editor.";

export const CHARGE_TOKENS_DUPLICATE_OVERLOADS_MESSAGE =
  "Duplicate charge_tokens overloads detected in pg_proc. Run Copy SQL fix — PostgREST may not expose overloaded functions reliably.";

export const CHARGE_TOKENS_WRONG_SIGNATURE_MESSAGE =
  "charge_tokens in pg_proc has an unexpected signature. Run Copy SQL patch — it drops all overloads and recreates the canonical function.";

export const ENSURE_USER_PROFILE_VOID_MESSAGE =
  "Old ensure_user_profile return type detected (void). Run Copy SQL fix — the repair patch drops old functions first.";

/** Normalize pg_get_function_identity_arguments for comparison. */
export function normalizePgArgs(args: string): string {
  return args.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Accept p_user_id-first (production) or legacy p_amount-first overloads. */
export function isCanonicalChargeTokensArgs(args: string): boolean {
  const n = normalizePgArgs(args);
  if (n === normalizePgArgs(CANONICAL_CHARGE_TOKENS_PG_ARGS)) return true;
  const parts = n.split(",").map((p) => p.trim());
  if (parts.length < 6) return false;
  const hasUserIdFirst = parts[0]?.startsWith("p_user_id uuid") || parts[0] === "uuid";
  const hasAmountFirst = parts[0]?.startsWith("p_amount integer") || parts[0] === "integer";
  const hasUuid = parts.filter((p) => p.endsWith(" uuid") || p === "uuid").length >= 3;
  const hasInt = parts.some((p) => p.endsWith(" integer") || p === "integer");
  const hasText = parts.filter((p) => p.endsWith(" text") || p === "text").length >= 2;
  const hasJsonb = parts.some((p) => p.endsWith(" jsonb") || p === "jsonb");
  if (!hasUuid || !hasInt || !hasText || !hasJsonb) return false;
  return hasUserIdFirst || hasAmountFirst;
}

export function isCanonicalEnsureUserProfileArgs(args: string): boolean {
  const n = normalizePgArgs(args);
  return n === "uuid, text" || n === "uuid,text";
}

/** Build the single canonical charge_tokens RPC payload (probe or live charge). */
export function buildChargeTokensRpcPayload(
  overrides: Partial<ChargeTokensRpcPayload> = {},
): ChargeTokensRpcPayload {
  return {
    p_amount: overrides.p_amount ?? 0,
    p_conversation_id: overrides.p_conversation_id ?? null,
    p_idempotency_key: overrides.p_idempotency_key ?? `probe_${Date.now()}`,
    p_metadata: (overrides.p_metadata ?? { probe: true }) as Json,
    p_project_id: overrides.p_project_id ?? null,
    p_reason: overrides.p_reason ?? "schema_probe",
    p_user_id: overrides.p_user_id ?? CHARGE_TOKENS_PROBE_USER_ID,
  };
}

export function buildChargeTokensProbePayload(
  overrides: Partial<ChargeTokensRpcPayload> = {},
): ChargeTokensRpcPayload {
  return buildChargeTokensRpcPayload({
    p_amount: 0,
    p_reason: "schema_probe",
    p_idempotency_key: `probe_${Date.now()}`,
    p_metadata: { probe: true },
    ...overrides,
  });
}

export function projectRefFromSupabaseUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? null;
}

export function supabaseUrlHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export function getSupabaseEnvSource(): "local" | "production" | "unknown" {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").toLowerCase();
  if (url.includes("127.0.0.1") || url.includes("localhost")) return "local";
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development") {
    return "local";
  }
  if (process.env.NODE_ENV === "development") return "local";
  if (process.env.NODE_ENV === "production") return "production";
  return "unknown";
}
