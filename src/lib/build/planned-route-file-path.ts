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
