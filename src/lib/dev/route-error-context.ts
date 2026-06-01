/** Collect route error context for error boundaries (works without global owner console). */

export const ROUTE_ERROR_STORAGE_KEY = "vodex.lastRouteError";

export type RouteErrorBoundary = "root" | "app" | "workspace" | "global" | "ai-chat";

export type RouteErrorPayload = {
  at: string;
  boundary: RouteErrorBoundary;
  message: string;
  name?: string;
  stack?: string;
  digest?: string;
  route?: string;
  pathname?: string;
  search?: string;
  searchParams?: Record<string, string>;
  projectId?: string | null;
  autostart?: string | null;
  strategy?: string | null;
  conversationId?: string | null;
  jobId?: string | null;
  userAgent?: string;
  boundarySource: "client" | "server";
};

function readSearchParamsRecord(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(window.location.search).entries()) {
    out[k] = v;
  }
  return out;
}

function extractProjectId(pathname: string): string | null {
  const m = pathname.match(/\/apps\/([0-9a-f-]{36})\//i);
  return m?.[1] ?? null;
}

export function collectRouteErrorContext(
  error: Error & { digest?: string },
  boundary: RouteErrorBoundary,
): RouteErrorPayload {
  const pathname = typeof window !== "undefined" ? window.location.pathname : undefined;
  const search = typeof window !== "undefined" ? window.location.search : undefined;
  const params = readSearchParamsRecord();

  return {
    at: new Date().toISOString(),
    boundary,
    message: error.message || "Unknown error",
    name: error.name,
    stack: error.stack,
    digest: error.digest,
    route: pathname && search ? `${pathname}${search}` : pathname,
    pathname,
    search,
    searchParams: params,
    projectId: pathname ? extractProjectId(pathname) : null,
    autostart: params.autostart ?? null,
    strategy: params.strategy ?? null,
    conversationId: params.conversationId ?? null,
    jobId: params.jobId ?? null,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    boundarySource: "client",
  };
}

export function persistRouteErrorPayload(payload: RouteErrorPayload): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(ROUTE_ERROR_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function readPersistedRouteErrorPayload(): RouteErrorPayload | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ROUTE_ERROR_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RouteErrorPayload;
  } catch {
    return null;
  }
}
