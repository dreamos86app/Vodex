/** Welcome / landing routes vs authenticated app home — preview routing. */

const WELCOME_PATH_RE =
  /^\/(?:welcome|splash|onboarding|intro|landing|signin|sign-in|start|get-started)?$/i;

const APP_HOME_PATHS = [
  "/home",
  "/dashboard",
  "/app",
  "/main",
  "/feed",
  "/recipes",
  "/browse",
  "/discover",
  "/library",
  "/menu",
  "/explore",
  "/today",
  "/inbox",
  "/kitchen",
  "/cook",
];

export function isWelcomeLikeRoutePath(path: string): boolean {
  const p = path.trim().toLowerCase();
  if (p === "/" || p === "") return true;
  return WELCOME_PATH_RE.test(p);
}

export function isAppHomeRoutePath(path: string): boolean {
  const lower = path.trim().toLowerCase();
  return APP_HOME_PATHS.some((pref) => lower === pref || lower.startsWith(`${pref}/`));
}

export function isWelcomeLikeRouteSource(source: string): boolean {
  return /welcome|landing|splash|onboarding|intro|signin|get-started|marketing|hero/i.test(source);
}

/** Label for preview route picker — distinguishes welcome landing from app home. */
export function previewRouteLabel(path: string, source: string, allPaths: string[]): string {
  const lower = path.toLowerCase();
  const hasDedicatedHome = allPaths.some((p) => isAppHomeRoutePath(p));

  if (isWelcomeLikeRoutePath(path) || isWelcomeLikeRouteSource(source)) {
    if (lower === "/" && hasDedicatedHome) return "Welcome";
    if (/welcome/i.test(source) || /welcome/i.test(path)) return "Welcome";
    if (/landing|splash|onboarding|intro/i.test(source) || /landing|splash|onboarding|intro/i.test(path)) {
      const seg = path.split("/").filter(Boolean).pop() ?? "Welcome";
      return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/[-_]/g, " ");
    }
    if (lower === "/" && hasDedicatedHome) return "Welcome";
  }

  if (isAppHomeRoutePath(path) || /^home$/i.test(path.split("/").filter(Boolean).pop() ?? "")) {
    return "Home";
  }

  if (path === "/") return hasDedicatedHome ? "Welcome" : "Home";

  const seg = path.split("/").filter(Boolean).pop() ?? path;
  const clean = seg.replace(/:.*$/, "").replace(/\[.*\]/, "");
  return clean.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Page";
}

/** Route to open after preview login — never a welcome/landing gate. */
export function resolvePreviewAppHomeRoute(paths: string[]): string {
  const normalized = [...new Set(paths.map(normalizePreviewRoutePath))];

  for (const pref of APP_HOME_PATHS) {
    const found = normalized.find((p) => p.toLowerCase() === pref);
    if (found) return found;
  }

  const candidate = normalized.find(
    (p) =>
      !isWelcomeLikeRoutePath(p) &&
      !isWelcomeLikeRouteSource(p) &&
      !/\/(?:welcome|splash|onboarding|intro|landing|login|signup|auth)(?:\/|$)/i.test(p) &&
      !/admin|diagnostic|debug|test-auth|authdiagnost/i.test(p.toLowerCase()),
  );

  if (candidate) return candidate;

  const nonRoot = normalized.find((p) => p !== "/" && !isWelcomeLikeRoutePath(p));
  if (nonRoot) return nonRoot;

  return normalized.includes("/") ? "/" : "/home";
}

export function normalizePreviewRoutePath(path: string): string {
  const p = path.trim();
  if (!p || p === "/") return "/";
  return p.startsWith("/") ? p.replace(/\/+$/, "") || "/" : `/${p.replace(/\/+$/, "")}`;
}

/** Default route for unauthenticated preview (welcome / marketing). */
export function resolvePreviewWelcomeRoute(paths: string[]): string {
  const normalized = paths.map(normalizePreviewRoutePath);
  const welcome = normalized.find(
    (p) =>
      isWelcomeLikeRoutePath(p) ||
      /\/(?:welcome|landing|splash|onboarding|intro)(?:\/|$)/i.test(p),
  );
  return welcome ?? (normalized.includes("/") ? "/" : normalized[0] ?? "/");
}
