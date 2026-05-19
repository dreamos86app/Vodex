import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
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

async function ensureProfileForAuthUser(
  admin: ReturnType<typeof createSupabaseAdmin>,
  authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> },
): Promise<void> {
  const email = (authUser.email ?? "").trim();
  if (!email) return;

  const meta = authUser.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    null;
  const avatarUrl = typeof meta.avatar_url === "string" ? meta.avatar_url : null;

  const { data: existing } = await admin.from("profiles").select("id").eq("id", authUser.id).maybeSingle();
  if (!existing) {
    await admin.from("profiles").insert({
      id: authUser.id,
      email,
      full_name: fullName,
      avatar_url: avatarUrl,
    } as never);
  } else if (email) {
    await admin
      .from("profiles")
      .update({
        email,
        full_name: fullName ?? undefined,
        avatar_url: avatarUrl ?? undefined,
      })
      .eq("id", authUser.id);
  }
}

export async function listAdminUsers(options: {
  q?: string;
  plan?: string;
  status?: string;
  limit?: number;
}): Promise<{ users: AdminUserListRow[]; error?: string }> {
  const admin = createSupabaseAdmin();
  const limit = Math.min(options.limit ?? 500, 500);
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

  const profileIds = new Set<string>();
  for (const u of authUsers.slice(0, limit)) {
    profileIds.add(u.id);
    await ensureProfileForAuthUser(admin, u);
  }

  const ids = [...profileIds].slice(0, limit);
  if (ids.length === 0) {
    return { users: [] };
  }

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select(
      "id,email,full_name,display_name,avatar_url,plan_id,credits_remaining,created_at,last_active_at,suspended_at,stripe_customer_id,stripe_subscription_id,credits_reset_at",
    )
    .in("id", ids);

  if (profileError) {
    return { users: [], error: profileError.message };
  }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const { data: subs } = await admin
    .from("subscriptions")
    .select(
      "user_id,status,current_period_end,cancel_at_period_end,pending_downgrade_plan,plan_id",
    )
    .in("user_id", ids);

  const subByUser = new Map((subs ?? []).map((s) => [s.user_id, s]));

  const [projectsRes, convRes, jobsRes] = await Promise.all([
    admin.from("projects").select("owner_id").in("owner_id", ids),
    admin.from("conversations").select("user_id").in("user_id", ids),
    admin.from("build_jobs").select("user_id").in("user_id", ids),
  ]);

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
    (projectsRes.data ?? []) as Array<{ owner_id: string }>,
    "owner_id",
  );
  const convCounts = countBy(
    (convRes.data ?? []) as Array<{ user_id: string }>,
    "user_id",
  );
  const jobCounts = countBy(
    (jobsRes.data ?? []) as Array<{ user_id: string }>,
    "user_id",
  );

  const rows: AdminUserListRow[] = [];

  for (const au of authUsers.slice(0, limit)) {
    const p = profileMap.get(au.id);
    const email = (p?.email || au.email || "").trim();
    if (!email) continue;

    const planId = normalizePlanId(p?.plan_id ?? "free");
    const sub = subByUser.get(au.id);

    const row: AdminUserListRow = {
      id: au.id,
      email,
      full_name: p?.full_name ?? null,
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      plan_id: planId,
      subscription_status: sub?.status ?? (p?.stripe_subscription_id ? "active" : null),
      tokens_remaining: p?.credits_remaining ?? 0,
      monthly_token_limit: monthlyTokensForPlan(planId),
      created_at: p?.created_at ?? au.created_at ?? new Date().toISOString(),
      last_active_at: p?.last_active_at ?? au.last_sign_in_at ?? null,
      suspended_at: p?.suspended_at ?? null,
      stripe_customer_id: p?.stripe_customer_id ?? null,
      stripe_subscription_id: p?.stripe_subscription_id ?? null,
      projects_count: projectCounts.get(au.id) ?? 0,
      conversations_count: convCounts.get(au.id) ?? 0,
      build_jobs_count: jobCounts.get(au.id) ?? 0,
      cancel_at_period_end: sub?.cancel_at_period_end ?? false,
      current_period_end: sub?.current_period_end ?? null,
      pending_downgrade_plan: (sub?.pending_downgrade_plan as PlanId | null) ?? null,
    };

    rows.push(row);
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

  return { users: filtered };
}
