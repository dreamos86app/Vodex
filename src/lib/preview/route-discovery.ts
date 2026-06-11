import type { BuildFile } from "@/lib/build/generated-file-utils";
import type { PreviewRouteEntry } from "@/lib/preview/detect-preview-routes";

function norm(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function labelFromPath(routePath: string): string {
  if (routePath === "/") return "Home";
  const seg = routePath.split("/").filter(Boolean).pop() ?? routePath;
  const clean = seg.replace(/:.*$/, "").replace(/\[.*\]/, "");
  return clean.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Page";
}

const SKIP_SEGMENTS = new Set([
  "auth",
  "login",
  "signup",
  "sign-up",
  "forgot-password",
  "reset-password",
  "callback",
  "_auth",
  "admin",
]);

function isAdminOrDiagnosticRoute(path: string): boolean {
  const lower = path.toLowerCase();
  return /admin|diagnostic|debug|test-auth|authdiagnost/.test(lower);
}

function isAuthRoute(path: string): boolean {
  const parts = path.split("/").filter(Boolean);
  return parts.some((p) => SKIP_SEGMENTS.has(p.toLowerCase()));
}

/** Parse React Router <Route path="..."> and createBrowserRouter entries from source. */
function routesFromRouterSource(content: string, sourcePath: string): PreviewRouteEntry[] {
  const found: PreviewRouteEntry[] = [];
  const routeRe = /<Route[^>]*\spath=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = routeRe.exec(content))) {
    let p = m[1]!.trim();
    if (!p.startsWith("/")) p = `/${p}`;
    if (p.includes("*")) continue;
    if (!isAuthRoute(p)) {
      found.push({ path: p, label: labelFromPath(p), source: sourcePath });
    }
  }

  const browserRe = /path:\s*["']([^"']+)["']/gi;
  while ((m = browserRe.exec(content))) {
    let p = m[1]!.trim();
    if (!p.startsWith("/")) p = `/${p}`;
    if (p.includes("*")) continue;
    if (!isAuthRoute(p)) {
      found.push({ path: p, label: labelFromPath(p), source: sourcePath });
    }
  }

  return found;
}

/** Base44 / manifest style route lists in JSON or JS exports. */
function routesFromManifest(content: string, sourcePath: string): PreviewRouteEntry[] {
  const found: PreviewRouteEntry[] = [];
  const pathRe = /["']path["']\s*:\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(content))) {
    let p = m[1]!.trim();
    if (!p.startsWith("/")) p = `/${p}`;
    if (!isAuthRoute(p)) found.push({ path: p, label: labelFromPath(p), source: sourcePath });
  }
  return found;
}

/** Discover pages from pages/ and src/pages/ folder structure (Vite/React). */
function routesFromPagesFolder(files: BuildFile[]): PreviewRouteEntry[] {
  const found: PreviewRouteEntry[] = [];
  for (const file of files) {
    const p = norm(file.path);
    const pagesMatch = p.match(/^(?:src\/)?pages\/(.+)\.(tsx|jsx|ts|js)$/i);
    if (!pagesMatch) continue;
    const name = pagesMatch[1]!;
    if (name.startsWith("_") || name.includes("api/")) continue;
    if (/^index$/i.test(name)) {
      found.push({ path: "/", label: "Home", source: p });
      continue;
    }
    const routePath = `/${name.replace(/\/index$/i, "")}`;
    if (!isAuthRoute(routePath)) {
      found.push({ path: routePath, label: labelFromPath(routePath), source: p });
    }
  }
  return found;
}

/** src/views, src/screens common in imported apps */
function routesFromViewsFolder(files: BuildFile[]): PreviewRouteEntry[] {
  const found: PreviewRouteEntry[] = [];
  for (const file of files) {
    const p = norm(file.path);
    const m = p.match(/^src\/(?:views|screens|pages)\/([^/]+)\.(tsx|jsx)$/i);
    if (!m) continue;
    const name = m[1]!.replace(/Page$/i, "").replace(/Screen$/i, "");
    const routePath = name.toLowerCase() === "home" || name.toLowerCase() === "index" ? "/" : `/${name}`;
    if (!isAuthRoute(routePath)) {
      found.push({ path: routePath, label: labelFromPath(routePath), source: p });
    }
  }
  return found;
}

export function discoverImportedAppRoutes(files: BuildFile[]): PreviewRouteEntry[] {
  const routes = new Map<string, PreviewRouteEntry>();

  const add = (entries: PreviewRouteEntry[]) => {
    for (const e of entries) {
      if (!routes.has(e.path)) routes.set(e.path, e);
    }
  };

  for (const file of files) {
    const p = norm(file.path);
    if (/^(?:src\/)?app\/page\.(tsx|jsx|ts|js)$/i.test(p)) {
      add([{ path: "/", label: "Home", source: p }]);
      continue;
    }
    const appPage = p.match(/^(?:src\/)?app\/(.+)\/page\.(tsx|jsx|ts|js)$/i);
    if (appPage) {
      const segments = appPage[1]!
        .split("/")
        .filter((s) => !s.startsWith("(") && s !== "page");
      const routePath = segments.length ? `/${segments.join("/")}` : "/";
      if (!isAuthRoute(routePath)) {
        add([{ path: routePath, label: labelFromPath(routePath), source: p }]);
      }
      continue;
    }

    if (/App\.(tsx|jsx)$/i.test(p) || /main\.(tsx|jsx)$/i.test(p) || /router\.(tsx|jsx|ts|js)$/i.test(p)) {
      add(routesFromRouterSource(file.content, p));
    }

    if (/routes?\.(json|ts|js)$/i.test(p) || /manifest\.(json|ts|js)$/i.test(p)) {
      add(routesFromManifest(file.content, p));
    }
  }

  add(routesFromPagesFolder(files));
  add(routesFromViewsFolder(files));

  for (const file of files) {
    const p = norm(file.path);
    const pagesRoute = p.match(/^(?:src\/)?pages\/(.+)\.(tsx|jsx|ts|js)$/i);
    if (pagesRoute) {
      const name = pagesRoute[1]!;
      if (name === "index" || name === "_app" || name === "_document") {
        if (name === "index") add([{ path: "/", label: "Home", source: p }]);
        continue;
      }
      if (name.includes("[")) continue;
      const routePath = `/${name.replace(/\/index$/i, "")}`;
      if (!isAuthRoute(routePath)) add([{ path: routePath, label: labelFromPath(routePath), source: p }]);
    }
  }

  if (files.some((f) => /index\.html$/i.test(norm(f.path)))) {
    add([{ path: "/", label: "Home", source: "index.html" }]);
  }

  const sorted = [...routes.values()].sort((a, b) => a.path.localeCompare(b.path));
  return sorted.length ? sorted : [{ path: "/", label: "Home", source: "default" }];
}

export function routePathsFromDiscovery(files: BuildFile[]): string[] {
  return discoverImportedAppRoutes(files).map((r) => r.path);
}

const WELCOME_LIKE = /^\/(?:welcome|splash|onboarding|intro|landing)?$/i;

const POST_AUTH_ROUTE_PREFS = [
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
];

function normalizeRoutePath(path: string): string {
  const p = path.trim();
  if (!p || p === "/") return "/";
  return p.startsWith("/") ? p.replace(/\/+$/, "") || "/" : `/${p.replace(/\/+$/, "")}`;
}

/** First sensible in-app route after preview login — skips welcome/auth gates. */
export function resolvePreviewPostAuthRoute(paths: string[]): string {
  const normalized = [...new Set(paths.map(normalizeRoutePath))];

  for (const pref of POST_AUTH_ROUTE_PREFS) {
    const found = normalized.find((p) => p.toLowerCase() === pref.toLowerCase());
    if (found) return found;
  }

  const candidate = normalized.find(
    (p) =>
      p !== "/" &&
      !WELCOME_LIKE.test(p) &&
      !isAuthRoute(p) &&
      !isAdminOrDiagnosticRoute(p) &&
      !/\/welcome|splash|onboarding|intro|landing/i.test(p),
  );

  return candidate ?? "/home";
}

export function routesFromProjectMetadata(meta: Record<string, unknown> | null | undefined): string[] {
  if (!meta) return [];
  if (Array.isArray(meta.discovered_routes)) {
    return meta.discovered_routes.filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  }
  const manifest = meta.route_manifest;
  if (manifest && typeof manifest === "object" && !Array.isArray(manifest)) {
    const paths = (manifest as { paths?: unknown }).paths;
    if (Array.isArray(paths)) {
      return paths.filter((p): p is string => typeof p === "string" && p.trim().length > 0);
    }
  }
  const importMeta = meta.import;
  if (importMeta && typeof importMeta === "object" && !Array.isArray(importMeta)) {
    const routes = (importMeta as { routes?: unknown }).routes;
    if (Array.isArray(routes)) {
      return routes.filter((p): p is string => typeof p === "string" && p.trim().length > 0);
    }
  }
  return [];
}
