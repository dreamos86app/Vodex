import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import { creditCap } from "@/lib/credits/normalize-credit-balance";
import { loadCanonicalCredits, adminFieldsFromCanonical } from "@/lib/credits/canonical-credits";
import type { PlanId } from "@/lib/supabase/types";

export type AdminUserListRow = {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  plan_id: PlanId;
  subscription_status: string | null;
  tokens_remaining: number;
  monthly_token_limit: number;
  bonus_credits: number;
  /** Plan allowance + active bonus (max spendable this period). */
  build_credits_cap: number;
  action_credits_remaining: number;
  action_credits_plan_allowance: number;
  action_credits_bonus: number;
  action_credits_cap: number;
  used_this_period: number;
  reserved_credits: number;
  is_test_or_grant_account: boolean;
  created_at: string;
  last_active_at: string | null;
  suspended_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  projects_count: number;
  conversations_count: number;
  build_jobs_count: number;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  pending_downgrade_plan: PlanId | null;
};

/** Loose profile row — only fields we read (select * safe after migration). */
type ProfileRow = Record<string, unknown> & {
  id?: string;
  email?: string;
  full_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  plan_id?: string;
  credits_remaining?: number | null;
  monthly_token_limit?: number | null;
  created_at?: string;
  last_active_at?: string | null;
  suspended_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function ensureProfileForAuthUser(
  admin: ReturnType<typeof createSupabaseAdmin>,
  authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> },
): Promise<void> {
  const email = (authUser.email ?? "").trim();
  if (!email) return;

  const { data: existing } = await admin.from("profiles").select("id").eq("id", authUser.id).maybeSingle();
  if (existing) return;

  const meta = authUser.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    null;

  // Minimal insert — only columns guaranteed after base migration shell
  const { error } = await admin.from("profiles").insert({
    id: authUser.id,
    email,
    full_name: fullName,
    display_name: fullName,
    credits_remaining: monthlyTokensForPlan("free"),
    plan_id: "free",
  } as never);

  if (error && !error.message.includes("duplicate")) {
    console.warn("[admin/list-users] profile insert:", error.message);
  }
}

async function loadProfiles(
  admin: ReturnType<typeof createSupabaseAdmin>,
  ids: string[],
): Promise<{ rows: ProfileRow[]; error?: string }> {
  if (ids.length === 0) return { rows: [] };

  const { data, error } = await admin.from("profiles").select("*").in("id", ids);

  if (!error) {
    return { rows: (data ?? []) as ProfileRow[] };
  }

  // Last resort: id + email only (broken schema)
  const { data: minimal, error: minErr } = await admin
    .from("profiles")
    .select("id,email,created_at")
    .in("id", ids);

  if (minErr) {
    return { rows: [], error: minErr.message };
  }

  return {
    rows: (minimal ?? []) as ProfileRow[],
    error: error.message,
  };
}

export async function listAdminUsers(options: {
  q?: string;
  plan?: string;
  status?: string;
  limit?: number;
}): Promise<{ users: AdminUserListRow[]; error?: string; warning?: string }> {
  const admin = createSupabaseAdmin();
  const limit = Math.min(options.limit ?? 50, 200);
  const q = options.q?.trim().toLowerCase();

  const authUsers: Array<{
    id: string;
    email?: string;
    created_at?: string;
    last_sign_in_at?: string;
    user_metadata?: Record<string, unknown>;
  }> = [];

  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return { users: [], error: error.message };
    }
    const batch = data.users ?? [];
    authUsers.push(...batch);
    if (batch.length < perPage || authUsers.length >= limit) break;
    page += 1;
  }

  const slice = authUsers.slice(0, limit);
  await Promise.all(slice.map((u) => ensureProfileForAuthUser(admin, u)));

  const ids = slice.map((u) => u.id);
  if (ids.length === 0) {
    return { users: [] };
  }

  const { rows: profiles, error: profileError } = await loadProfiles(admin, ids);
  const profileMap = new Map(profiles.map((p) => [String(p.id), p]));

  let subs: Array<{
    user_id: string;
    status: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    pending_downgrade_plan: string | null;
  }> = [];

  const subsRes = await admin
    .from("subscriptions")
    .select("user_id,status,current_period_end,cancel_at_period_end,pending_downgrade_plan")
    .in("user_id", ids);

  if (!subsRes.error) {
    subs = (subsRes.data ?? []) as typeof subs;
  }

  const subByUser = new Map(subs.map((s) => [s.user_id, s]));

  const [projectsRes, convRes, jobsRes, actionBalanceRes] = await Promise.all([
    admin.from("projects").select("owner_id").in("owner_id", ids),
    admin.from("conversations").select("user_id").in("user_id", ids),
    admin.from("build_jobs").select("user_id").in("user_id", ids),
    admin
      .from("action_credit_balances" as never)
      .select("owner_user_id, balance")
      .in("owner_user_id" as never, ids)
      .is("project_id" as never, null),
  ]);

  const actionBalanceByUser = new Map<string, number>();
  for (const row of actionBalanceRes.data ?? []) {
    const r = row as { owner_user_id: string; balance?: number };
    actionBalanceByUser.set(r.owner_user_id, num(r.balance, 0));
  }

  const countBy = (rows: Array<{ owner_id?: string; user_id?: string }> | null, key: "owner_id" | "user_id") => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      const id = r[key];
      if (!id) continue;
      m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  };

  const projectCounts = countBy(
    projectsRes.error ? [] : (projectsRes.data as Array<{ owner_id: string }>),
    "owner_id",
  );
  const convCounts = countBy(
    convRes.error ? [] : (convRes.data as Array<{ user_id: string }>),
    "user_id",
  );
  const jobCounts = countBy(
    jobsRes.error ? [] : (jobsRes.data as Array<{ user_id: string }>),
    "user_id",
  );

  const canonicalByUser = new Map(
    await Promise.all(
      slice.map(async (au) => {
        const p = profileMap.get(au.id);
        const planId = normalizePlanId(str(p?.plan_id) ?? "free");
        const canonical = await loadCanonicalCredits({
          userId: au.id,
          planId,
          creditsResetAt: str(p?.credits_reset_at),
          buildAvailable:
            typeof p?.credits_remaining === "number" ? p.credits_remaining : undefined,
          skipLedger: true,
        });
        return [au.id, canonical] as const;
      }),
    ),
  );

  const rows: AdminUserListRow[] = [];

  for (const au of slice) {
    const p = profileMap.get(au.id);
    const email = (str(p?.email) || au.email || "").trim();
    if (!email) continue;

    const planId = normalizePlanId(str(p?.plan_id) ?? "free");
    const sub = subByUser.get(au.id);
    const canonical = canonicalByUser.get(au.id);
    const canonicalFields = canonical
      ? adminFieldsFromCanonical(canonical)
      : adminFieldsFromCanonical({
          build: {
            available: num(p?.credits_remaining, monthlyTokensForPlan(planId)),
            planAllowance: monthlyTokensForPlan(planId),
            usedThisPeriod: 0,
            bonusActive: 0,
            bonusLabel: null,
            bonusExpiresAt: null,
            resetDate: str(p?.credits_reset_at),
            reserved: 0,
            source: "canonical_balance" as const,
          },
          action: {
            available: actionBalanceByUser.get(au.id) ?? monthlyActionCreditsForPlan(planId),
            planAllowance: monthlyActionCreditsForPlan(planId),
            usedThisPeriod: 0,
            bonusActive: 0,
            bonusLabel: null,
            bonusExpiresAt: null,
            resetDate: str(p?.credits_reset_at),
            reserved: 0,
            source: "canonical_balance" as const,
          },
          planId,
        });

    const buildPlanAllowance = canonicalFields.monthly_token_limit;
    const explicitBuildBonus = canonicalFields.bonus_credits;
    const actionPlanAllowance = canonicalFields.action_credits_plan_allowance;
    const explicitActionBonus = canonicalFields.action_credits_bonus;

    rows.push({
      id: au.id,
      email,
      full_name: str(p?.full_name),
      display_name: str(p?.display_name),
      avatar_url: str(p?.avatar_url),
      plan_id: planId,
      subscription_status:
        sub?.status ?? (str(p?.subscription_status) ?? (p?.stripe_subscription_id ? "active" : null)),
      tokens_remaining: canonicalFields.tokens_remaining,
      monthly_token_limit: canonicalFields.monthly_token_limit,
      bonus_credits: canonicalFields.bonus_credits,
      build_credits_cap: creditCap(buildPlanAllowance, explicitBuildBonus),
      action_credits_remaining: canonicalFields.action_credits_remaining,
      action_credits_plan_allowance: canonicalFields.action_credits_plan_allowance,
      action_credits_bonus: canonicalFields.action_credits_bonus,
      action_credits_cap: creditCap(actionPlanAllowance, explicitActionBonus),
      used_this_period: canonicalFields.used_this_period,
      reserved_credits: canonicalFields.reserved_credits,
      is_test_or_grant_account: canonicalFields.is_test_or_grant_account,
      created_at: str(p?.created_at) ?? au.created_at ?? new Date().toISOString(),
      last_active_at: str(p?.last_active_at) ?? au.last_sign_in_at ?? null,
      suspended_at: str(p?.suspended_at),
      stripe_customer_id: str(p?.stripe_customer_id),
      stripe_subscription_id: str(p?.stripe_subscription_id),
      projects_count: projectCounts.get(au.id) ?? 0,
      conversations_count: convCounts.get(au.id) ?? 0,
      build_jobs_count: jobCounts.get(au.id) ?? 0,
      cancel_at_period_end: sub?.cancel_at_period_end ?? false,
      current_period_end: sub?.current_period_end ?? null,
      pending_downgrade_plan: sub?.pending_downgrade_plan
        ? normalizePlanId(sub.pending_downgrade_plan)
        : null,
    });
  }

  let filtered = rows;

  if (q) {
    filtered = filtered.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name?.toLowerCase().includes(q) ?? false) ||
        (u.display_name?.toLowerCase().includes(q) ?? false) ||
        u.id.toLowerCase().includes(q),
    );
  }

  if (options.plan && options.plan !== "all") {
    filtered = filtered.filter((u) => u.plan_id === normalizePlanId(options.plan!));
  }

  if (options.status === "suspended") {
    filtered = filtered.filter((u) => u.suspended_at != null);
  } else if (options.status === "active") {
    filtered = filtered.filter((u) => u.suspended_at == null);
  }

  filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    users: filtered,
    error: profileError && filtered.length === 0 ? profileError : undefined,
    warning:
      profileError && filtered.length > 0
        ? `Partial profile data: ${profileError}. Run migration 20260525120000_profiles_production_complete.sql on Supabase.`
        : undefined,
  };
}
