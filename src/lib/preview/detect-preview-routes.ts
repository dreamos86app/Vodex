import type { BuildFile } from "@/lib/build/generated-file-utils";

export type PreviewRouteEntry = {
  path: string;
  label: string;
  source: string;
};

function norm(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function labelFromPath(routePath: string): string {
  if (routePath === "/") return "Home";
  const seg = routePath.split("/").filter(Boolean).pop() ?? routePath;
  return seg.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function detectPreviewRoutesFromFiles(files: BuildFile[]): PreviewRouteEntry[] {
  const routes = new Map<string, PreviewRouteEntry>();

  for (const file of files) {
    const p = norm(file.path);
    const appPage = p.match(/^app\/(.+)\/page\.(tsx|jsx|ts|js)$/i);
    if (appPage) {
      const segments = appPage[1]!
        .split("/")
        .filter((s) => !s.startsWith("(") && s !== "page");
      const routePath = segments.length ? `/${segments.join("/")}` : "/";
      routes.set(routePath, {
        path: routePath,
        label: labelFromPath(routePath),
        source: p,
      });
      continue;
    }
    const pagesRoute = p.match(/^pages\/(.+)\.(tsx|jsx|ts|js)$/i);
    if (pagesRoute) {
      const name = pagesRoute[1]!;
      if (name === "index" || name === "_app" || name === "_document") {
        if (name === "index") routes.set("/", { path: "/", label: "Home", source: p });
        continue;
      }
      if (name.includes("[")) continue;
      const routePath = `/${name.replace(/\/index$/i, "")}`;
      routes.set(routePath, { path: routePath, label: labelFromPath(routePath), source: p });
    }
  }

  if (files.some((f) => norm(f.path) === "index.html" || /\/index\.html$/i.test(norm(f.path)))) {
    routes.set("/", { path: "/", label: "Home", source: "index.html" });
  }

  const sorted = [...routes.values()].sort((a, b) => a.path.localeCompare(b.path));
  return sorted.length ? sorted : [{ path: "/", label: "Home", source: "default" }];
}
