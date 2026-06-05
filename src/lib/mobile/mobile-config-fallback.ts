import type { SupabaseClient } from "@supabase/supabase-js";
import type { MobileAppConfig } from "@/lib/mobile/types";
import { migrateLegacyPackageId, suggestPackageId } from "@/lib/mobile/package-validation";

export function isMissingMobileConfigTableError(message: string): boolean {
  return /could not find the table|schema cache|mobile_app_configs/i.test(message);
}

export function defaultMobileConfigFromProject(
  projectId: string,
  project: {
    name: string;
    app_name?: string | null;
    short_description?: string | null;
    icon_url?: string | null;
  },
): Partial<MobileAppConfig> {
  const appName = project.app_name ?? project.name;
  return {
    project_id: projectId,
    platforms: [],
    wrapper_type: "capacitor",
    app_name: appName,
    short_name: appName.slice(0, 12),
    app_description: project.short_description ?? null,
    package_id: suggestPackageId(appName),
    bundle_id: suggestPackageId(appName),
    meta: { splash_duration_ms: 2000 },
    theme_color: "#6366f1",
    version_name: "0.0.1",
    android_version_code: 1,
    ios_build_number: 1,
    permissions: {},
    features: {},
    store_draft: {},
    icon_url: project.icon_url ?? null,
    splash_url: null,
    readiness_android: null,
    readiness_ios: null,
    readiness_store: null,
  };
}

export function readMobileConfigFromMetadata(
  metadata: unknown,
): Partial<MobileAppConfig> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).mobile_config;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Partial<MobileAppConfig>;
}

export async function saveMobileConfigFallback(
  admin: SupabaseClient,
  projectId: string,
  userId: string,
  patch: Partial<MobileAppConfig>,
): Promise<{ ok: true; config: Partial<MobileAppConfig> } | { ok: false; error: string }> {
  const { data: row } = await admin
    .from("projects")
    .select("metadata")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();

  const prevMeta =
    row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  const prev = readMobileConfigFromMetadata(prevMeta) ?? {};
  const next = { ...prev, ...patch, project_id: projectId, updated_at: new Date().toISOString() };

  const { error } = await admin
    .from("projects")
    .update({ metadata: { ...prevMeta, mobile_config: next } as never })
    .eq("id", projectId)
    .eq("owner_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, config: next };
}
