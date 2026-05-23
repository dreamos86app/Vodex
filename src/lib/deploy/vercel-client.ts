import { getVercelServerConfig, type VercelConnectionState } from "@/lib/deploy/vercel-config";

export type VercelServerConfig = ReturnType<typeof getVercelServerConfig>;

export type VercelDeployFile = { path: string; content: string };

export type VercelDeployResult =
  | { ok: true; deploymentId: string; url: string | null; state: string }
  | { ok: false; error: string; code: string };

function apiBase() {
  return "https://api.vercel.com";
}

function headers(token: string, teamId: string | null): HeadersInit {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (teamId) h["x-vercel-team-id"] = teamId;
  return h;
}

function teamQuery(teamId: string | null): string {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

export async function fetchVercelDeploymentStatus(input: {
  deploymentId: string;
  projectMeta?: Record<string, unknown>;
}): Promise<{ state: string; url: string | null }> {
  const cfg = getVercelServerConfig(input.projectMeta);
  if (!cfg.token) return { state: "not_connected", url: null };

  const res = await fetch(
    `${apiBase()}/v13/deployments/${input.deploymentId}${teamQuery(cfg.teamId)}`,
    { headers: headers(cfg.token, cfg.teamId) },
  );
  if (!res.ok) return { state: "error", url: null };
  const data = (await res.json()) as { readyState?: string; url?: string };
  return { state: data.readyState ?? "unknown", url: data.url ?? null };
}

export async function getVercelDeployment(
  cfg: VercelServerConfig,
  deploymentId: string,
): Promise<{ id: string; readyState?: string; state?: string; url?: string }> {
  const res = await fetch(
    `${apiBase()}/v13/deployments/${deploymentId}${teamQuery(cfg.teamId)}`,
    { headers: headers(cfg.token, cfg.teamId) },
  );
  if (!res.ok) throw new Error("Vercel deployment fetch failed");
  return (await res.json()) as { id: string; readyState?: string; state?: string; url?: string };
}

export async function getVercelDeploymentEvents(
  cfg: VercelServerConfig,
  deploymentId: string,
): Promise<unknown[]> {
  const res = await fetch(
    `${apiBase()}/v2/deployments/${deploymentId}/events${teamQuery(cfg.teamId)}`,
    { headers: headers(cfg.token, cfg.teamId) },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? data : [];
}

/**
 * Token-based deploy: uploads file bundle to Vercel deployments API.
 * Returns URL only when Vercel responds with one.
 */
export async function createVercelDeployment(input: {
  name: string;
  files: VercelDeployFile[];
  projectMeta?: Record<string, unknown>;
}): Promise<VercelDeployResult> {
  const cfg = getVercelServerConfig(input.projectMeta);
  if (!cfg.token) {
    return { ok: false, error: "Vercel token not configured", code: "not_connected" };
  }
  if (!cfg.projectId) {
    return { ok: false, error: "Link VERCEL_PROJECT_ID or project metadata", code: "needs_project_link" };
  }

  const vercelFiles = input.files.map((f) => ({
    file: f.path.replace(/^\//, ""),
    data: Buffer.from(f.content, "utf8").toString("base64"),
    encoding: "base64",
  }));

  const body = {
    name: input.name,
    project: cfg.projectId,
    target: "production",
    files: vercelFiles,
  };

  const qs = cfg.teamId ? `?teamId=${cfg.teamId}` : "";
  const res = await fetch(`${apiBase()}/v13/deployments${qs}`, {
    method: "POST",
    headers: headers(cfg.token, cfg.teamId),
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: { id?: string; url?: string; readyState?: string; error?: { message?: string } };
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: text.slice(0, 200) || "Invalid Vercel response", code: "provider_error" };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: json.error?.message ?? text.slice(0, 200),
      code: "provider_error",
    };
  }

  if (!json.id) {
    return { ok: false, error: "No deployment id from Vercel", code: "provider_error" };
  }

  return {
    ok: true,
    deploymentId: json.id,
    url: json.url ?? null,
    state: json.readyState ?? "BUILDING",
  };
}
