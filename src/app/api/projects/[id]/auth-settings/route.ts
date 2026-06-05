import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEntitlements } from "@/lib/billing/plan-entitlements";
import {
  parseCustomOAuthVault,
  publicCustomOAuthStatus,
  sealCustomOAuthInput,
  validateCustomOAuthEnable,
} from "@/lib/publish/custom-oauth-store";

export const dynamic = "force-dynamic";

function sanitizeSettingsForClient(row: Record<string, unknown>) {
  const vault = parseCustomOAuthVault(row.custom_oauth);
  return {
    email_password_enabled: row.email_password_enabled !== false,
    google_enabled: row.google_enabled === true,
    github_enabled: row.github_enabled === true,
    apple_enabled: row.apple_enabled === true,
    oauth_mode: row.oauth_mode === "custom" ? "custom" : "vodex_managed",
    last_auth_error: typeof row.last_auth_error === "string" ? row.last_auth_error : null,
    last_auth_error_at: typeof row.last_auth_error_at === "string" ? row.last_auth_error_at : null,
    customOAuth: publicCustomOAuthStatus(vault),
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Unavailable" }, { status: 503 });

  const { data } = (await admin
    .from("app_auth_provider_settings" as never)
    .select("*")
    .eq("project_id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle()) as { data: Record<string, unknown> | null };

  const settings = data
    ? sanitizeSettingsForClient(data)
    : {
        email_password_enabled: true,
        google_enabled: false,
        github_enabled: false,
        apple_enabled: false,
        oauth_mode: "vodex_managed" as const,
        last_auth_error: null,
        last_auth_error_at: null,
        customOAuth: publicCustomOAuthStatus({}),
      };

  return NextResponse.json({ settings });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Record<string, unknown>;
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Unavailable" }, { status: 503 });

  const { data: prof } = await supabase.from("profiles").select("plan_id").eq("id", user.id).maybeSingle();
  const entitlements = getEntitlements(prof?.plan_id ?? "free");

  const wantsCustom = body.oauth_mode === "custom";
  if (wantsCustom && !entitlements.canUseCustomOAuth) {
    return NextResponse.json({ error: "Custom OAuth requires Pro or higher." }, { status: 403 });
  }

  const { data: existingRow } = (await admin
    .from("app_auth_provider_settings" as never)
    .select("custom_oauth")
    .eq("project_id", projectId)
    .maybeSingle()) as { data: { custom_oauth?: unknown } | null };

  const existingVault = parseCustomOAuthVault(existingRow?.custom_oauth);
  const customOAuthInput = body.custom_oauth as
    | {
        google?: { client_id?: string; client_secret?: string };
        github?: { client_id?: string; client_secret?: string };
      }
    | undefined;

  const custom_oauth =
    customOAuthInput && wantsCustom
      ? sealCustomOAuthInput({ existing: existingVault, ...customOAuthInput })
      : existingVault;

  const google_enabled = body.google_enabled === true;
  const github_enabled = body.github_enabled === true;
  const apple_enabled = body.apple_enabled === true;
  const oauth_mode = wantsCustom ? "custom" : "vodex_managed";

  if (oauth_mode === "custom") {
    const validation = validateCustomOAuthEnable({
      vault: custom_oauth,
      google_enabled,
      github_enabled,
      apple_enabled,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.errors.join(" ") }, { status: 400 });
    }
  }

  const payload = {
    project_id: projectId,
    owner_id: user.id,
    email_password_enabled: body.email_password_enabled !== false,
    google_enabled,
    github_enabled,
    apple_enabled,
    oauth_mode,
    custom_oauth,
    custom_oauth_meta: {
      updated_at: new Date().toISOString(),
      google_configured: Boolean(custom_oauth.google?.client_id && custom_oauth.google?.client_secret_sealed),
      github_configured: Boolean(custom_oauth.github?.client_id && custom_oauth.github?.client_secret_sealed),
    },
    updated_at: new Date().toISOString(),
  };

  await admin
    .from("app_auth_provider_settings" as never)
    .upsert(payload as never, { onConflict: "project_id" });

  return NextResponse.json({
    ok: true,
    settings: {
      ...sanitizeSettingsForClient(payload),
    },
  });
}
