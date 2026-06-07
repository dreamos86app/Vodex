/**
 * Verify generated routes exist, are linked, and are reachable from navigation.
 */
import {
  countRenderablePages,
  filterRenderableBuildFiles,
  normalizeBuildFilePath,
  type BuildFile,
} from "@/lib/build/generated-file-utils";

export type RouteConnectivityResult = {
  routes: string[];
  linkedRoutes: string[];
  orphanRoutes: string[];
  missingLinks: string[];
  verifiedCount: number;
  totalCount: number;
  passes: boolean;
  failures: string[];
};

const ROUTE_PAGE_RE = /^app\/(.+?)\/page\.(tsx|jsx)$/i;
const LINK_HREF_RE = /(?:href|to)\s*=\s*["'{`](\/[^"'`}\s]+)/g;
const LINK_COMPONENT_RE = /<Link[^>]+href=["'](\/[^"']+)["']/g;

function routeFromPagePath(path: string): string | null {
  const norm = normalizeBuildFilePath(path);
  if (/^app\/page\.(tsx|jsx)$/i.test(norm)) return "/";
  const m = norm.match(ROUTE_PAGE_RE);
  if (!m) return null;
  const slug = m[1]!.replace(/\/page\.(tsx|jsx)$/i, "");
  if (!slug || slug.includes("[")) return `/${slug}`;
  return `/${slug}`;
}

function collectRoutes(files: BuildFile[]): string[] {
  const routes = new Set<string>();
  for (const f of files) {
    const route = routeFromPagePath(f.path);
    if (route) routes.add(route);
  }
  return [...routes].sort();
}

function collectLinkedRoutes(files: BuildFile[]): Set<string> {
  const linked = new Set<string>();
  const ui = files
    .filter((f) => /\.(tsx|jsx)$/i.test(f.path))
    .map((f) => f.content)
    .join("\n");

  for (const re of [LINK_HREF_RE, LINK_COMPONENT_RE]) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(ui)) !== null) {
      const href = m[1]!;
      if (href.startsWith("/") && !href.startsWith("//")) {
        linked.add(href.split("?")[0]!.split("#")[0]!);
      }
    }
  }
  return linked;
}

export function checkRouteConnectivity(files: BuildFile[]): RouteConnectivityResult {
  const renderable = filterRenderableBuildFiles(files);
  const routes = collectRoutes(renderable);
  const linked = collectLinkedRoutes(renderable);
  const failures: string[] = [];

  const orphanRoutes = routes.filter((r) => r !== "/" && !linked.has(r));
  const missingLinks: string[] = [];

  if (routes.length < 3) {
    failures.push(`route_count_${routes.length}_lt_3`);
  }
  if (!routes.includes("/")) {
    failures.push("missing_root_route");
  }
  if (!routes.some((r) => /dashboard|home/i.test(r)) && routes.length > 2) {
    failures.push("missing_dashboard_or_home");
  }

  const requiredReachable = routes.filter((r) => r !== "/");
  const verifiedCount = requiredReachable.filter((r) => linked.has(r)).length;
  const totalCount = requiredReachable.length;

  if (orphanRoutes.length > Math.max(1, Math.floor(routes.length * 0.4))) {
    failures.push(`orphan_routes_${orphanRoutes.length}`);
  }

  const passes =
    failures.length === 0 &&
    verifiedCount >= Math.max(2, Math.floor(totalCount * 0.6));

  return {
    routes,
    linkedRoutes: [...linked].sort(),
    orphanRoutes,
    missingLinks,
    verifiedCount,
    totalCount,
    passes,
    failures,
  };
}

export function routeConnectivityScore(result: RouteConnectivityResult): number {
  if (result.routes.length === 0) return 0;
  const linkRatio =
    result.totalCount > 0 ? result.verifiedCount / result.totalCount : 0;
  const routeBonus = Math.min(30, result.routes.length * 3);
  const linkScore = Math.round(linkRatio * 70);
  const orphanPenalty = result.orphanRoutes.length * 8;
  return Math.max(0, Math.min(100, routeBonus + linkScore - orphanPenalty));
}

export function countAppRoutes(files: BuildFile[]): number {
  return countRenderablePages(filterRenderableBuildFiles(files));
}
