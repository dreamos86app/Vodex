import { getVercelServerConfig, type VercelConnectionState } from "@/lib/deploy/vercel-config";

export type VercelConnectionSnapshot = {
  state: VercelConnectionState | "token_invalid";
  hasToken: boolean;
  tokenValid: boolean | null;
  teamConfigured: boolean;
  projectLinked: boolean;
  projectId: string | null;
  teamId: string | null;
  envSyncOk: boolean;
  missingEnv: string[];
  message: string;
};

const REQUIRED_ENV = ["VERCEL_ACCESS_TOKEN"] as const;
const OPTIONAL_ENV = ["VERCEL_TEAM_ID", "VERCEL_PROJECT_ID"] as const;

export function missingVercelEnvVars(): string[] {
  const missing: string[] = [];
  if (!process.env.VERCEL_ACCESS_TOKEN?.trim()) missing.push("VERCEL_ACCESS_TOKEN");
  return missing;
}

export async function validateVercelAccessToken(
  token: string,
  teamId?: string | null,
): Promise<boolean> {
  if (!token) return false;
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  try {
    const res = await fetch(`https://api.vercel.com/v2/user${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Resolve honest Vercel connection — never fakes ready/deployed. */
export async function resolveVercelConnection(
  projectMeta?: Record<string, unknown>,
  options?: { validateToken?: boolean },
): Promise<VercelConnectionSnapshot> {
  const cfg = getVercelServerConfig(projectMeta);
  const missingEnv = missingVercelEnvVars();
  const envSyncOk = missingEnv.length === 0;
  const teamConfigured = Boolean(cfg.teamId);
  const projectLinked = Boolean(cfg.projectId);

  if (!cfg.hasToken) {
    return {
      state: missingEnv.length > 0 ? "missing_env" : "not_connected",
      hasToken: false,
      tokenValid: false,
      teamConfigured,
      projectLinked,
      projectId: cfg.projectId,
      teamId: cfg.teamId,
      envSyncOk,
      missingEnv,
      message:
        missingEnv.length > 0
          ? `Missing server env: ${missingEnv.join(", ")}`
          : "Set VERCEL_ACCESS_TOKEN on the server (never in the browser).",
    };
  }

  let tokenValid: boolean | null = null;
  if (options?.validateToken !== false) {
    tokenValid = await validateVercelAccessToken(cfg.token, cfg.teamId);
    if (!tokenValid) {
      return {
        state: "token_invalid",
        hasToken: true,
        tokenValid: false,
        teamConfigured,
        projectLinked,
        projectId: cfg.projectId,
        teamId: cfg.teamId,
        envSyncOk,
        missingEnv,
        message: "VERCEL_ACCESS_TOKEN is set but rejected by Vercel — check token and team ID.",
      };
    }
  }

  if (!projectLinked) {
    return {
      state: "needs_project_link",
      hasToken: true,
      tokenValid: tokenValid ?? true,
      teamConfigured,
      projectLinked: false,
      projectId: null,
      teamId: cfg.teamId,
      envSyncOk,
      missingEnv,
      message: "Token OK — link VERCEL_PROJECT_ID or project metadata vercel_project_id.",
    };
  }

  return {
    state: "ready",
    hasToken: true,
    tokenValid: tokenValid ?? true,
    teamConfigured,
    projectLinked: true,
    projectId: cfg.projectId,
    teamId: cfg.teamId,
    envSyncOk,
    missingEnv,
    message: "Ready to deploy via Vercel API.",
  };
}

export { OPTIONAL_ENV, REQUIRED_ENV };
