import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  isStatusColumnMissingError,
  isStatusPermissionDeniedError,
  isStatusSchemaMissingError,
  isStatusTableMissingError,
} from "@/lib/status/status-db";

const CORE_TABLES = ["status_components", "platform_announcements"] as const;

export type StatusSchemaState = {
  ready: boolean;
  serviceRoleConfigured: boolean;
  missingTables: string[];
  hint: string | null;
};

async function probeTableExists(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: string,
): Promise<{ exists: boolean; missing: boolean }> {
  const { error } = await db.from(table).select("id").limit(1);
  if (!error) return { exists: true, missing: false };
  if (isStatusTableMissingError(error)) return { exists: false, missing: true };
  return { exists: true, missing: false };
}

/** Accurate readiness: tables must exist; missing optional columns do not block admin UI. */
export async function getStatusSchemaState(): Promise<StatusSchemaState> {
  const admin = createServiceRoleClient();
  if (!admin) {
    return {
      ready: false,
      serviceRoleConfigured: false,
      missingTables: [],
      hint:
        "SUPABASE_SERVICE_ROLE_KEY is not set in the server environment. Add it to .env.local and restart the dev server.",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const missingTables: string[] = [];

  for (const table of CORE_TABLES) {
    const probe = await probeTableExists(db, table);
    if (probe.missing) missingTables.push(table);
  }

  if (missingTables.length > 0) {
    return {
      ready: false,
      serviceRoleConfigured: true,
      missingTables,
      hint: null,
    };
  }

  return {
    ready: true,
    serviceRoleConfigured: true,
    missingTables: [],
    hint: null,
  };
}

/** @deprecated use getStatusSchemaState */
export async function checkStatusSchemaReady(): Promise<boolean> {
  const state = await getStatusSchemaState();
  return state.ready;
}

export const ANNOUNCEMENT_SELECT_TIERS = [
  "id,title,message,severity,banner_type,is_active,priority,link_label,link_url,gradient_from,gradient_to,text_color,icon_type,effect_key,background_preset,effect_preset,icon_preset,animated_icon_enabled,accent_color,outline_color,target_scope,target_plan,target_email,starts_at,ends_at,created_at",
  "id,title,message,severity,is_active,priority,link_label,link_url,gradient_from,gradient_to,text_color,icon_type,effect_key,created_at",
  "id,title,message,severity,is_active,priority,link_label,link_url,created_at",
  "id,title,message,severity,is_active,priority,created_at",
] as const;

export async function loadPlatformAnnouncementsAdmin(): Promise<{
  rows: unknown[];
  error: string | null;
}> {
  const admin = createServiceRoleClient();
  if (!admin) {
    return { rows: [], error: "Service role unavailable" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  for (const select of ANNOUNCEMENT_SELECT_TIERS) {
    const res = await db
      .from("platform_announcements")
      .select(select)
      .order("created_at", { ascending: false })
      .limit(30);
    if (!res.error) return { rows: res.data ?? [], error: null };
    if (isStatusTableMissingError(res.error)) {
      return { rows: [], error: res.error.message ?? "Table missing" };
    }
    if (isStatusPermissionDeniedError(res.error)) {
      return {
        rows: [],
        error:
          "Permission denied loading platform_announcements — ensure SUPABASE_SERVICE_ROLE_KEY is set on the server (admin routes require service role, not the anon key).",
      };
    }
    if (!isStatusColumnMissingError(res.error) && !isStatusSchemaMissingError(res.error)) {
      return { rows: [], error: res.error.message ?? "Query failed" };
    }
  }

  return { rows: [], error: "Could not load announcements — reload PostgREST schema cache." };
}
