import type { BuildFile } from "@/lib/build/generated-file-utils";
import type { PreviewRouteEntry } from "@/lib/preview/detect-preview-routes";
import {
  previewRouteLabel,
  resolvePreviewAppHomeRoute,
} from "@/lib/preview/preview-route-roles";

function norm(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function labelFromPath(routePath: string, source?: string, allPaths?: string[]): string {
  if (allPaths?.length) return previewRouteLabel(routePath, source ?? "", allPaths);
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
      found.push({ path: p, label: labelFromPath(p, sourcePath), source: sourcePath });
    }
  }

  const browserRe = /path:\s*["']([^"']+)["']/gi;
  while ((m = browserRe.exec(content))) {
    let p = m[1]!.trim();
    if (!p.startsWith("/")) p = `/${p}`;
    if (p.includes("*")) continue;
    if (!isAuthRoute(p)) {
      found.push({ path: p, label: labelFromPath(p, sourcePath), source: sourcePath });
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
    if (!isAuthRoute(p)) found.push({ path: p, label: labelFromPath(p, sourcePath), source: sourcePath });
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
      found.push({ path: "/", label: labelFromPath("/", p), source: p });
      continue;
    }
    const routePath = `/${name.replace(/\/index$/i, "").toLowerCase()}`;
    if (!isAuthRoute(routePath)) {
      found.push({ path: routePath, label: labelFromPath(routePath, p), source: p });
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
    const normalizedName = name.toLowerCase();
    const routePath = normalizedName === "index" ? "/" : `/${normalizedName}`;
    if (!isAuthRoute(routePath)) {
      found.push({ path: routePath, label: labelFromPath(routePath, p), source: p });
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
        add([{ path: routePath, label: labelFromPath(routePath, p), source: p }]);
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
        if (name === "index") add([{ path: "/", label: labelFromPath("/", p), source: p }]);
        continue;
      }
      if (name.includes("[")) continue;
      const routePath = `/${name.replace(/\/index$/i, "").toLowerCase()}`;
      if (!isAuthRoute(routePath)) add([{ path: routePath, label: labelFromPath(routePath, p), source: p }]);
    }
  }

  if (files.some((f) => /index\.html$/i.test(norm(f.path)))) {
    add([{ path: "/", label: labelFromPath("/", "index.html"), source: "index.html" }]);
  }

  const pathList = [...routes.keys()];
  const refined = [...routes.values()].map((r) => ({
    ...r,
    label: labelFromPath(r.path, r.source, pathList),
  }));

  const deduped = new Map<string, PreviewRouteEntry>();
  for (const r of refined) {
    const key = r.path.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, r);
  }

  const sorted = [...deduped.values()].sort((a, b) => a.path.localeCompare(b.path));
  return sorted.length ? sorted : [{ path: "/", label: "Welcome", source: "default" }];
}

export function routePathsFromDiscovery(files: BuildFile[]): string[] {
  return discoverImportedAppRoutes(files).map((r) => r.path);
}

/** @deprecated use resolvePreviewAppHomeRoute from preview-route-roles */
export function resolvePreviewPostAuthRoute(paths: string[]): string {
  return resolvePreviewAppHomeRoute(paths);
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
