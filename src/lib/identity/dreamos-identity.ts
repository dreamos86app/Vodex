import type { SupabaseClient } from "@supabase/supabase-js";
import { getSiteUrl } from "@/lib/app-url";
import {
  loadProfileOptionalFields,
  loadUserProfileCore,
} from "@/lib/supabase/load-user-profile";
import { resolveWorkspaceIdForUser } from "@/lib/identity/resolve-workspace-id";
import { monthlyTokensForPlan } from "@/lib/billing/plans";

const FREE_CREDITS_FALLBACK = monthlyTokensForPlan("free");

export type DreamosIdentity = {
  accountId: string;
  workspaceId: string;
  ownerEmail: string;
  planId: string;
  planInterval: string;
  creditsRemaining: number;
  creditsLimit: number;
  createdAt: string | null;
};

export type DreamosIdentityApiPayload = {
  ok: true;
  accountId: string;
  workspaceId: string;
  ownerEmail: string;
  plan: { id: string; interval: string };
  credits: { remaining: number; limit: number };
  createdAt: string | null;
  apiBaseUrl: string;
  apiAccessStatus: "enabled" | "disabled";
};

export function getDreamosApiBaseUrl(): string {
  const app = getSiteUrl().replace(/\/$/, "");
  return `${app}/api`;
}

export function truncateIdentityId(value: string, head = 8, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function projectRefFromSupabaseUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? null;
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

/**
 * Safe server identity load — never throws; tolerates missing billing columns.
 */
export async function buildDreamosIdentity(
  supabase: SupabaseClient,
  accountId: string,
  ownerEmail?: string | null,
): Promise<DreamosIdentity> {
  const [{ profile }, optional, workspaceId] = await Promise.all([
    loadUserProfileCore(supabase, accountId),
    loadProfileOptionalFields(supabase, accountId),
    resolveWorkspaceIdForUser(supabase, accountId),
  ]);

  const email =
    (ownerEmail ?? "").trim() ||
    (typeof profile?.email === "string" ? profile.email : "") ||
    "";

  const creditsRemaining =
    typeof profile?.credits_remaining === "number" ? profile.credits_remaining : FREE_CREDITS_FALLBACK;
  const profileRecord = profile as { credits_limit?: number } | null | undefined;
  const creditsLimit =
    typeof profileRecord?.credits_limit === "number" ? profileRecord.credits_limit : FREE_CREDITS_FALLBACK;

  let createdAt: string | null = null;
  try {
    const { data: createdRow } = await supabase
      .from("profiles")
      .select("created_at")
      .eq("id", accountId)
      .maybeSingle();
    if (typeof createdRow?.created_at === "string") createdAt = createdRow.created_at;
  } catch {
    /* optional */
  }

  return {
    accountId,
    workspaceId,
    ownerEmail: email,
    planId: typeof profile?.plan_id === "string" ? profile.plan_id : "free",
    planInterval: optional.plan_interval ?? "monthly",
    creditsRemaining,
    creditsLimit,
    createdAt,
  };
}

export function toDreamosIdentityApiPayload(
  identity: DreamosIdentity,
  apiAccessStatus: "enabled" | "disabled" = "enabled",
): DreamosIdentityApiPayload {
  return {
    ok: true,
    accountId: identity.accountId,
    workspaceId: identity.workspaceId,
    ownerEmail: identity.ownerEmail,
    plan: { id: identity.planId, interval: identity.planInterval },
    credits: {
      remaining: identity.creditsRemaining,
      limit: identity.creditsLimit,
    },
    createdAt: identity.createdAt,
    apiBaseUrl: getDreamosApiBaseUrl(),
    apiAccessStatus,
  };
}
