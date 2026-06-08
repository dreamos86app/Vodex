/** Map a blueprint/design route to a likely Next.js page file path for in-flight UI. */
export function routeToPlannedFilePath(route: string): string {
  const raw = route.trim().replace(/\\/g, "/");
  if (!raw || raw === "/") return "app/page.tsx";
  const seg = raw
    .replace(/^\//, "")
    .split("/")
    .filter(Boolean)
    .map((part) => (part.startsWith("[") ? "item" : part))
    .join("/");
  return `app/${seg}/page.tsx`;
}

export function uniquePlannedFilePaths(routes: string[], limit = 10): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const route of routes) {
    const path = routeToPlannedFilePath(route);
    const key = path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(path);
    if (out.length >= limit) break;
  }
  return out;
}
