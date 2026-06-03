import { safeFetch } from "@/lib/network/safe-fetch";

export type SupabaseMgmtProject = {
  id: string;
  name: string;
  region: string;
  organization_id: string;
  ref: string;
};

export async function listSupabaseMgmtProjects(
  accessToken: string,
): Promise<{ ok: true; projects: SupabaseMgmtProject[] } | { ok: false; error: string }> {
  const { response, error } = await safeFetch(
    "https://api.supabase.com/v1/projects",
    { headers: { Authorization: `Bearer ${accessToken}` } },
    "supabase_mgmt_list_projects",
  );
  if (!response) {
    return { ok: false, error: error?.userMessage ?? "Could not reach Supabase API" };
  }
  const json = (await response.json().catch(() => [])) as SupabaseMgmtProject[] | { message?: string };
  if (!response.ok) {
    const msg = Array.isArray(json) ? "Supabase API error" : json.message ?? "Supabase API error";
    return { ok: false, error: msg };
  }
  return { ok: true, projects: Array.isArray(json) ? json : [] };
}

export async function fetchSupabaseProjectApiKeys(
  accessToken: string,
  projectRef: string,
): Promise<
  | { ok: true; url: string; anonKey: string; serviceRoleKey?: string }
  | { ok: false; error: string }
> {
  const { response, error } = await safeFetch(
    `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/api-keys`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    "supabase_mgmt_api_keys",
  );
  if (!response) {
    return { ok: false, error: error?.userMessage ?? "Could not fetch API keys" };
  }
  const json = (await response.json().catch(() => ({}))) as
    | Array<{ name?: string; api_key?: string }>
    | { message?: string };
  if (!response.ok) {
    const msg = Array.isArray(json) ? "Failed to load keys" : json.message ?? "Failed to load keys";
    return { ok: false, error: msg };
  }
  const keys = Array.isArray(json) ? json : [];
  const anon = keys.find((k) => k.name === "anon" || k.name === "anon key")?.api_key;
  const service = keys.find((k) => k.name === "service_role")?.api_key;
  if (!anon) {
    return { ok: false, error: "Anon key not returned by Supabase API" };
  }
  const url = `https://${projectRef}.supabase.co`;
  return {
    ok: true,
    url,
    anonKey: anon,
    serviceRoleKey: service,
  };
}
