/**
 * Canonical admin runtime health — single truth source for schema/RPC verification.
 * Service role only. Missing[] is derived only from tables{} and rpcs{}.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  buildChargeTokensProbePayload,
  buildChargeTokensRpcPayload,
  isCanonicalChargeTokensArgs,
  isCanonicalEnsureUserProfileArgs,
  type ChargeTokensRpcPayload,
  type PgProcSignature,
  projectRefFromSupabaseUrl,
} from "@/lib/db/charge-tokens-rpc";
import { invalidateChargeTokensProbeCache } from "@/lib/db/charge-probe-cache";
import { safeFetch } from "@/lib/network/safe-fetch";
import { pushRuntimeDiagnostic } from "@/lib/dev/runtime-diagnostics";
import { dreamosLog } from "@/lib/diagnostics/dreamos-logger";

export type TableHealth = { exists: boolean; lastError?: string };

export type RpcHealth = {
  existsInPostgres: boolean;
  callableByPostgrest: boolean;
  executableByServiceRole: boolean;
  lastError?: string;
};

export type AdminRuntimeMissingItem = {
  type: "table" | "rpc";
  name: string;
  reason: string;
  fix: string;
};

export type AdminRuntimeHealth = {
  ok: boolean;
  checkedAt: string;
  source: "fresh" | "cached";
  projectRef: string | null;
  helperRpcUnavailable: boolean;
  tables: {
    profiles: TableHealth;
    credit_events: TableHealth;
    token_ledger: TableHealth;
    ai_usage_logs: TableHealth;
    admin_audit_logs: TableHealth;
    runtime_diagnostics: TableHealth;
    admin_pending_confirmations: TableHealth;
    projects: TableHealth;
    conversations: TableHealth;
    messages: TableHealth;
    app_files: TableHealth;
    build_jobs: TableHealth;
  };
  rpcs: {
    charge_tokens: RpcHealth;
    ensure_user_profile: RpcHealth;
    charge_credits: RpcHealth;
    grant_tokens: RpcHealth;
    grant_credits: RpcHealth;
    grant_credits_admin: RpcHealth;
    complete_user_onboarding: RpcHealth;
    claim_referral_reward: RpcHealth;
    dreamos_debug_credit_rpc: RpcHealth;
  };
  missing: AdminRuntimeMissingItem[];
  warnings: string[];
  rawErrors: string[];
  contradictions: string[];
};

const TABLE_FIX =
  "Copy SQL patch → paste in Supabase SQL Editor → run entire file → NOTIFY pgrst reload → Refresh schema.";
const RPC_POSTGREST_FIX =
  "Reload PostgREST schema (NOTIFY pgrst, 'reload schema'), verify GRANT EXECUTE and exact function signature.";
const DEBUG_HELPER_WARNING =
  "Debug helper RPC is not available through PostgREST. This does not prove charge_tokens is missing from Postgres.";

const ADMIN_TABLES = [
  "profiles",
  "credit_events",
  "token_ledger",
  "ai_usage_logs",
  "admin_audit_logs",
  "admin_pending_confirmations",
  "projects",
  "conversations",
  "messages",
  "app_files",
  "build_jobs",
] as const;

type AdminTableKey = keyof AdminRuntimeHealth["tables"];

function isNotFoundFunction(msg: string | null | undefined): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    m.includes("could not find the function") ||
    m.includes("function public.") && m.includes("does not exist") ||
    m.includes("schema cache")
  );
}

function isTableNotFound(msg: string | null | undefined, code?: string): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    code === "42P01" ||
    m.includes("could not find the table") ||
    (m.includes("does not exist") && m.includes("relation"))
  );
}

async function probeTableExists(
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  table: string,
): Promise<TableHealth> {
  const { error } = await admin.from(table as "profiles").select("id").limit(0);
  if (!error) return { exists: true };
  if (isTableNotFound(error.message, error.code)) {
    return { exists: false, lastError: error.message.slice(0, 200) };
  }
  return { exists: true, lastError: error.message.slice(0, 200) };
}

async function probeRuntimeDiagnosticsTable(
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
): Promise<TableHealth> {
  const view = await admin.from("runtime_diagnostics" as "profiles").select("id").limit(0);
  if (!view.error) return { exists: true };
  const base = await admin.from("dreamos_diagnostic_logs" as "profiles").select("id").limit(0);
  if (!base.error) return { exists: true, lastError: "Using dreamos_diagnostic_logs (runtime_diagnostics view missing)" };
  if (isTableNotFound(view.error.message, view.error.code)) {
    return { exists: false, lastError: view.error.message.slice(0, 200) };
  }
  return { exists: false, lastError: base.error?.message?.slice(0, 200) };
}

type DebugCatalog = {
  helperRpcUnavailable: boolean;
  chargeSignatures: PgProcSignature[];
  ensureSignatures: PgProcSignature[];
  rpcExistsInPg: Record<string, boolean>;
  catalogError: string | null;
};

async function loadDebugCatalog(
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
): Promise<DebugCatalog> {
  const { data, error } = await admin.rpc("dreamos_debug_credit_rpc" as never);
  if (!error && data && typeof data === "object") {
    const parsed = data as Record<string, unknown>;
    const rawCharge = parsed.charge_tokens_signatures as Array<{ args?: string }> | undefined;
    const rawEnsure = parsed.ensure_user_profile_signatures as Array<{ args?: string }> | undefined;
    const rawGrantTokens = parsed.grant_tokens_signatures as Array<{ args?: string }> | undefined;
    const rawGrantCredits = parsed.grant_credits_signatures as Array<{ args?: string }> | undefined;
    const chargeSignatures = (rawCharge ?? []).map((s) => ({
      args: String(s.args ?? "").trim(),
      returns: "jsonb",
      arg_names: [],
    }));
    const ensureSignatures = (rawEnsure ?? []).map((s) => ({
      args: String(s.args ?? "").trim(),
      returns: "jsonb",
      arg_names: [],
    }));
    return {
      helperRpcUnavailable: false,
      chargeSignatures,
      ensureSignatures,
      rpcExistsInPg: {
        charge_tokens: chargeSignatures.length > 0,
        ensure_user_profile: ensureSignatures.length > 0,
        grant_tokens: (rawGrantTokens ?? []).length > 0,
        grant_credits: (rawGrantCredits ?? []).length > 0,
        grant_credits_admin: (rawGrantCredits ?? []).length > 0,
        dreamos_debug_credit_rpc: true,
      },
      catalogError: null,
    };
  }
  return {
    helperRpcUnavailable: true,
    chargeSignatures: [],
    ensureSignatures: [],
    rpcExistsInPg: {},
    catalogError: error?.message?.slice(0, 220) ?? "dreamos_debug_credit_rpc not callable",
  };
}

async function probePostgrestRpc(
  rpc: string,
  body: Record<string, unknown>,
): Promise<{ callable: boolean; lastError: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return { callable: false, lastError: "Supabase URL or service role key missing" };
  }
  const { response: res, error: fetchErr } = await safeFetch(
    `${url.replace(/\/$/, "")}/rest/v1/rpc/${rpc}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    `admin_health_postgrest_${rpc}`,
  );
  if (!res) {
    return { callable: false, lastError: fetchErr?.message ?? "fetch_failed" };
  }
  const text = await res.text().catch(() => "");
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    /* ignore */
  }
  const errMsg =
    (typeof parsed.message === "string" ? parsed.message : null) ??
    (typeof parsed.error === "string" ? parsed.error : null) ??
    (!res.ok ? `HTTP ${res.status}` : null);
  if (isNotFoundFunction(errMsg)) {
    return { callable: false, lastError: errMsg };
  }
  return { callable: true, lastError: errMsg };
}

async function probeServiceRoleRpc(
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  rpc: string,
  payload: Record<string, unknown>,
): Promise<{ executable: boolean; lastError: string | null; data?: unknown }> {
  const { data, error } = await admin.rpc(rpc as "charge_tokens", payload as never);
  if (!error) return { executable: true, lastError: null, data };
  if (isNotFoundFunction(error.message)) {
    return { executable: false, lastError: error.message };
  }
  return { executable: true, lastError: error.message, data };
}

function postgresExistsForRpc(
  catalog: DebugCatalog,
  rpc: string,
  signatures?: PgProcSignature[],
): boolean {
  if (catalog.rpcExistsInPg[rpc]) return true;
  if (rpc === "charge_tokens" && catalog.chargeSignatures.length > 0) {
    return catalog.chargeSignatures.some((s) => isCanonicalChargeTokensArgs(s.args));
  }
  if (rpc === "ensure_user_profile" && catalog.ensureSignatures.length > 0) {
    return catalog.ensureSignatures.some((s) => isCanonicalEnsureUserProfileArgs(s.args));
  }
  if (signatures && signatures.length > 0) return true;
  return false;
}

function buildMissingFromCanonical(
  tables: AdminRuntimeHealth["tables"],
  rpcs: AdminRuntimeHealth["rpcs"],
  helperRpcUnavailable: boolean,
): AdminRuntimeMissingItem[] {
  const missing: AdminRuntimeMissingItem[] = [];

  for (const [name, t] of Object.entries(tables) as [AdminTableKey, TableHealth][]) {
    if (!t.exists) {
      missing.push({
        type: "table",
        name,
        reason: "not_visible_via_postgrest",
        fix: TABLE_FIX,
      });
    }
  }

  for (const [name, r] of Object.entries(rpcs) as [keyof AdminRuntimeHealth["rpcs"], RpcHealth][]) {
    if (r.existsInPostgres && !r.callableByPostgrest) {
      missing.push({
        type: "rpc",
        name,
        reason: "exists_in_postgres_but_not_callable_by_postgrest",
        fix: RPC_POSTGREST_FIX,
      });
      continue;
    }
    if (!r.existsInPostgres && !r.callableByPostgrest && !r.executableByServiceRole) {
      if (name === "dreamos_debug_credit_rpc" && helperRpcUnavailable) continue;
      missing.push({
        type: "rpc",
        name,
        reason: helperRpcUnavailable ? "not_verified_helper_unavailable" : "missing_from_postgres_and_postgrest",
        fix: TABLE_FIX,
      });
    }
  }

  return missing;
}

function detectContradictions(
  tables: AdminRuntimeHealth["tables"],
  missing: AdminRuntimeMissingItem[],
): string[] {
  const out: string[] = [];
  for (const item of missing) {
    if (item.type !== "table") continue;
    const key = item.name as AdminTableKey;
    if (tables[key]?.exists) {
      out.push(`Table "${item.name}" marked exists=true but also listed in missing[]`);
    }
  }
  return out;
}

export async function getAdminRuntimeHealth(opts?: {
  refresh?: boolean;
}): Promise<AdminRuntimeHealth> {
  if (opts?.refresh) {
    invalidateChargeTokensProbeCache();
  }

  const checkedAt = new Date().toISOString();
  const projectRef = projectRefFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const rawErrors: string[] = [];
  const warnings: string[] = [];

  const admin = createServiceRoleClient();
  if (!admin) {
    return {
      ok: false,
      checkedAt,
      source: "fresh",
      projectRef,
      helperRpcUnavailable: true,
      tables: emptyTables(),
      rpcs: emptyRpcs(),
      missing: [
        {
          type: "table",
          name: "(service)",
          reason: "service_role_missing",
          fix: "Set SUPABASE_SERVICE_ROLE_KEY in server environment.",
        },
      ],
      warnings: ["SUPABASE_SERVICE_ROLE_KEY not configured"],
      rawErrors: ["SUPABASE_SERVICE_ROLE_KEY not configured"],
      contradictions: [],
    };
  }

  const adminClient: NonNullable<ReturnType<typeof createServiceRoleClient>> = admin;
  const catalog = await loadDebugCatalog(adminClient);
  if (catalog.helperRpcUnavailable) {
    warnings.push(DEBUG_HELPER_WARNING);
    if (catalog.catalogError) rawErrors.push(catalog.catalogError);
  }

  const tables = {} as AdminRuntimeHealth["tables"];
  for (const t of ADMIN_TABLES) {
    tables[t] = await probeTableExists(adminClient, t);
    if (!tables[t].exists && tables[t].lastError) rawErrors.push(`${t}: ${tables[t].lastError}`);
  }
  tables.runtime_diagnostics = await probeRuntimeDiagnosticsTable(adminClient);

  let probeUserId: string | null = null;
  const { data: probeProfile } = await adminClient
    .from("profiles")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (probeProfile?.id) probeUserId = probeProfile.id;

  const chargePayload = buildChargeTokensProbePayload(
    probeUserId ? { p_user_id: probeUserId } : { p_amount: 0 },
  );
  const chargePg = postgresExistsForRpc(catalog, "charge_tokens", catalog.chargeSignatures);
  const chargePostgrest = await probePostgrestRpc("charge_tokens", chargePayload as unknown as Record<string, unknown>);
  const chargeSr = await probeServiceRoleRpc(adminClient, "charge_tokens", chargePayload as unknown as Record<string, unknown>);
  if (!chargePg && !catalog.helperRpcUnavailable && chargeSr.executable) {
    /* service role reached it — treat as postgres exists */
  }
  const chargeExistsPg =
    chargePg || (chargeSr.executable && !isNotFoundFunction(chargeSr.lastError));

  const ensurePayload = probeUserId
    ? { p_user_id: probeUserId, p_email: "health-probe@dreamos86.local" }
    : { p_user_id: null, p_email: null };
  const ensurePg = postgresExistsForRpc(catalog, "ensure_user_profile", catalog.ensureSignatures);
  const ensurePostgrest = await probePostgrestRpc("ensure_user_profile", ensurePayload);
  const ensureSr = await probeServiceRoleRpc(adminClient, "ensure_user_profile", ensurePayload);
  const ensureExistsPg =
    ensurePg || (ensureSr.executable && !isNotFoundFunction(ensureSr.lastError));

  const debugPostgrest = await probePostgrestRpc("dreamos_debug_credit_rpc", {});
  const debugSr = await probeServiceRoleRpc(adminClient, "dreamos_debug_credit_rpc", {});

  async function probeNamedRpc(
    name: keyof AdminRuntimeHealth["rpcs"],
    body: Record<string, unknown>,
    pgFromCatalog?: boolean,
  ): Promise<RpcHealth> {
    const postgrest = await probePostgrestRpc(name, body);
    const sr = await probeServiceRoleRpc(adminClient, name, body);
    const existsInPostgres =
      pgFromCatalog !== undefined
        ? pgFromCatalog
        : postgresExistsForRpc(catalog, name) ||
          (sr.executable && !isNotFoundFunction(sr.lastError));
    return {
      existsInPostgres,
      callableByPostgrest: postgrest.callable,
      executableByServiceRole: sr.executable && !isNotFoundFunction(sr.lastError),
      lastError: sr.lastError ?? postgrest.lastError ?? undefined,
    };
  }

  const rpcs: AdminRuntimeHealth["rpcs"] = {
    charge_tokens: {
      existsInPostgres: chargeExistsPg,
      callableByPostgrest: chargePostgrest.callable,
      executableByServiceRole: chargeSr.executable && !isNotFoundFunction(chargeSr.lastError),
      lastError: chargeSr.lastError ?? chargePostgrest.lastError ?? undefined,
    },
    ensure_user_profile: {
      existsInPostgres: ensureExistsPg,
      callableByPostgrest: ensurePostgrest.callable,
      executableByServiceRole: ensureSr.executable && !isNotFoundFunction(ensureSr.lastError),
      lastError: ensureSr.lastError ?? ensurePostgrest.lastError ?? undefined,
    },
    dreamos_debug_credit_rpc: {
      existsInPostgres: !catalog.helperRpcUnavailable,
      callableByPostgrest: debugPostgrest.callable,
      executableByServiceRole: debugSr.executable && !isNotFoundFunction(debugSr.lastError),
      lastError: catalog.catalogError ?? debugSr.lastError ?? undefined,
    },
    charge_credits: await probeNamedRpc("charge_credits", chargePayload as unknown as Record<string, unknown>),
    grant_tokens: await probeNamedRpc(
      "grant_tokens",
      {
        p_user_id: probeUserId,
        p_amount: 0,
        p_reason: "health_probe",
        p_idempotency_key: `probe_grant_${Date.now()}`,
      },
      catalog.rpcExistsInPg.grant_tokens,
    ),
    grant_credits: await probeNamedRpc(
      "grant_credits",
      {
        p_admin_id: probeUserId,
        p_user_id: probeUserId,
        p_amount: 0,
        p_reason: "health_probe",
      },
      catalog.rpcExistsInPg.grant_credits,
    ),
    grant_credits_admin: await probeNamedRpc(
      "grant_credits_admin",
      {
        p_admin_id: probeUserId,
        p_user_id: probeUserId,
        p_amount: 0,
        p_reason: "health_probe",
      },
      catalog.rpcExistsInPg.grant_credits_admin,
    ),
    complete_user_onboarding: await probeNamedRpc("complete_user_onboarding", {
      p_user_id: chargePayload.p_user_id,
    }),
    claim_referral_reward: await probeNamedRpc("claim_referral_reward", {
      p_user_id: chargePayload.p_user_id,
    }),
  };

  const missing = buildMissingFromCanonical(tables, rpcs, catalog.helperRpcUnavailable);
  const contradictions = detectContradictions(tables, missing);

  if (contradictions.length > 0) {
    pushRuntimeDiagnostic("schema_check_contradiction", { contradictions });
    dreamosLog({
      source: "server",
      category: "supabase",
      severity: "error",
      action: "schema_health_contradiction",
      message: "Internal schema health contradiction detected",
      metadata: { contradictions },
    });
  }

  const ok = missing.length === 0 && contradictions.length === 0;

  if (!ok) {
    pushRuntimeDiagnostic("schema_check_failed", {
      missingCount: missing.length,
      chargeCallable: rpcs.charge_tokens.callableByPostgrest,
    });
  }

  return {
    ok,
    checkedAt,
    source: "fresh",
    projectRef,
    helperRpcUnavailable: catalog.helperRpcUnavailable,
    tables,
    rpcs,
    missing,
    warnings,
    rawErrors,
    contradictions,
  };
}

function emptyTables(): AdminRuntimeHealth["tables"] {
  return {
    profiles: { exists: false },
    credit_events: { exists: false },
    token_ledger: { exists: false },
    ai_usage_logs: { exists: false },
    admin_audit_logs: { exists: false },
    runtime_diagnostics: { exists: false },
    admin_pending_confirmations: { exists: false },
    projects: { exists: false },
    conversations: { exists: false },
    messages: { exists: false },
    app_files: { exists: false },
    build_jobs: { exists: false },
  };
}

function emptyRpcs(): AdminRuntimeHealth["rpcs"] {
  const empty: RpcHealth = {
    existsInPostgres: false,
    callableByPostgrest: false,
    executableByServiceRole: false,
  };
  return {
    charge_tokens: { ...empty },
    ensure_user_profile: { ...empty },
    charge_credits: { ...empty },
    grant_tokens: { ...empty },
    grant_credits: { ...empty },
    grant_credits_admin: { ...empty },
    complete_user_onboarding: { ...empty },
    claim_referral_reward: { ...empty },
    dreamos_debug_credit_rpc: { ...empty },
  };
}

/** Owner live test — charge 1 credit then restore via grant_credits. */
export async function verifyChargeTokensLiveTest(input: {
  ownerUserId: string;
  ownerAdminId: string;
}): Promise<{
  callable: boolean;
  chargedTest: boolean;
  restored: boolean;
  exactParamsUsed: string[];
  lastError: string | null;
  diagnosis: string;
  rpcPayload: ChargeTokensRpcPayload;
}> {
  const exactParamsUsed = [
    "p_user_id",
    "p_amount",
    "p_reason",
    "p_idempotency_key",
    "p_metadata",
    "p_project_id",
    "p_conversation_id",
  ];

  const admin = createServiceRoleClient();
  if (!admin) {
    return {
      callable: false,
      chargedTest: false,
      restored: false,
      exactParamsUsed,
      lastError: "service_role_missing",
      diagnosis: "service_role_missing",
      rpcPayload: buildChargeTokensRpcPayload({ p_user_id: input.ownerUserId }),
    };
  }

  try {
    await admin.rpc("dreamos_debug_credit_rpc" as never);
  } catch {
    /* optional warm-up */
  }

  const rpcPayload = buildChargeTokensRpcPayload({
    p_user_id: input.ownerUserId,
    p_amount: 1,
    p_reason: "admin_verify_charge_tokens_v2",
    p_idempotency_key: "admin_verify_charge_tokens_v2",
    p_metadata: { verify: true },
    p_project_id: null,
    p_conversation_id: null,
  });

  const postgrest = await probePostgrestRpc(
    "charge_tokens",
    rpcPayload as unknown as Record<string, unknown>,
  );
  const { data, error } = await admin.rpc("charge_tokens", rpcPayload as never);

  if (isNotFoundFunction(error?.message) || !postgrest.callable) {
    return {
      callable: false,
      chargedTest: false,
      restored: false,
      exactParamsUsed,
      lastError: error?.message ?? postgrest.lastError,
      diagnosis: "postgrest_schema_cache_or_signature_issue",
      rpcPayload,
    };
  }

  const chargedTest = !error && Boolean((data as { success?: boolean })?.success);
  let restored = false;
  if (chargedTest) {
    const { error: grantErr } = await admin.rpc("grant_credits", {
      p_admin_id: input.ownerAdminId,
      p_user_id: input.ownerUserId,
      p_amount: 1,
      p_reason: "admin_verify_charge_tokens_v2_restore",
    } as never);
    restored = !grantErr;
  }

  return {
    callable: true,
    chargedTest,
    restored,
    exactParamsUsed,
    lastError: error?.message ?? null,
    diagnosis: chargedTest
      ? restored
        ? "charge_tokens_ok_restored"
        : "charge_tokens_ok_restore_failed"
      : "charge_tokens_callable_but_test_charge_failed",
    rpcPayload,
  };
}
