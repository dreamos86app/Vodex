import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { MobileAppConfig } from "@/lib/mobile/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  defaultMobileConfigFromProject,
  isMissingMobileConfigTableError,
  readMobileConfigFromMetadata,
  saveMobileConfigFallback,
} from "@/lib/mobile/mobile-config-fallback";
import { sanitizeMobileConfigPatch } from "@/lib/mobile/readiness-gate";

const patchSchema = z.object({
  platforms: z.array(z.enum(["android", "ios"])).optional(),
  wrapper_type: z.enum(["capacitor", "twa"]).optional(),
  app_name: z.string().max(80).nullable().optional(),
  short_name: z.string().max(30).nullable().optional(),
  app_description: z.string().max(4000).nullable().optional(),
  package_id: z.string().max(120).nullable().optional(),
  bundle_id: z.string().max(120).nullable().optional(),
  theme_color: z.string().max(20).nullable().optional(),
  version_name: z.string().max(32).optional(),
  android_version_code: z.number().int().min(1).optional(),
  ios_build_number: z.number().int().min(1).optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
  features: z.record(z.string(), z.boolean()).optional(),
  store_draft: z.record(z.string(), z.unknown()).optional(),
  icon_url: z.string().url().nullable().optional(),
  splash_url: z.string().url().nullable().optional(),
  splash_duration_ms: z.number().int().min(500).max(15_000).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

async function loadProject(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, userId: string) {
  return supabase
    .from("projects")
    .select("id, name, owner_id, app_name, short_description, icon_url, preview_url, metadata")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await loadProject(supabase, projectId, user.id);
  if (!project.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const p = project.data;
  const metaConfig = readMobileConfigFromMetadata((p as { metadata?: unknown }).metadata);

  const { data: config, error: configErr } = await supabase
    .from("mobile_app_configs" as never)
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (configErr && isMissingMobileConfigTableError(configErr.message)) {
    const draft = metaConfig ?? defaultMobileConfigFromProject(projectId, p as never);
    return NextResponse.json({ config: draft, draft: true, storage: "metadata" });
  }

  if (config) {
    return NextResponse.json({ config });
  }

  const defaultConfig: Partial<MobileAppConfig> = {
    ...defaultMobileConfigFromProject(projectId, p as never),
  };

  return NextResponse.json({ config: defaultConfig, draft: true });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await loadProject(supabase, projectId, user.id);
  if (!project.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid config", details: parsed.error.flatten() }, { status: 400 });
  }

  const patch = sanitizeMobileConfigPatch(parsed.data);
  const { data: existing, error: existingErr } = await supabase
    .from("mobile_app_configs" as never)
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (existingErr && isMissingMobileConfigTableError(existingErr.message)) {
    const admin = createServiceRoleClient() ?? supabase;
    const saved = await saveMobileConfigFallback(admin, projectId, user.id, patch);
    if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });
    return NextResponse.json({ config: saved.config, storage: "metadata" });
  }

  const row = {
    ...patch,
    project_id: projectId,
    owner_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if ((existing as { id?: string } | null)?.id) {
    const { data, error } = await supabase
      .from("mobile_app_configs" as never)
      .update(row as never)
      .eq("project_id", projectId)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ config: data });
  }

  const { data, error } = await supabase
    .from("mobile_app_configs" as never)
    .insert({
      ...row,
      platforms: patch.platforms ?? [],
      wrapper_type: patch.wrapper_type ?? "capacitor",
      version_name: patch.version_name ?? "0.0.1",
      android_version_code: patch.android_version_code ?? 1,
      ios_build_number: patch.ios_build_number ?? 1,
      permissions: patch.permissions ?? {},
      features: patch.features ?? {},
      store_draft: patch.store_draft ?? {},
    } as never)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}
