import type { ZipImportFile } from "@/lib/import/zip-file-validator";

export type DetectedFramework = {
  id: "nextjs" | "vite" | "react" | "vue" | "svelte" | "static" | "express" | "unknown";
  label: string;
  confidence: number;
};

export function detectFramework(files: ZipImportFile[]): DetectedFramework {
  const pkg = files.find((f) => f.path === "package.json" || f.path.endsWith("/package.json"));
  const hasHtml = files.some((f) => /index\.html$/i.test(f.path));
  const hasAppDir = files.some((f) => /^app\/page\.(tsx|jsx|js)$/i.test(f.path) || f.path.includes("/app/page."));
  const hasPagesDir = files.some((f) => /^pages\/index\.(tsx|jsx|js)$/i.test(f.path));

  if (pkg) {
    try {
      const j = JSON.parse(pkg.content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const dep = { ...j.dependencies, ...j.devDependencies };
      if (dep.next) return { id: "nextjs", label: "Next.js", confidence: 0.95 };
      if (dep.nuxt) return { id: "nextjs", label: "Nuxt", confidence: 0.9 };
      if (dep.svelte || dep["@sveltejs/kit"]) return { id: "svelte", label: "SvelteKit", confidence: 0.9 };
      if (dep.vite || dep["@vitejs/plugin-vue"] || dep["@vitejs/plugin-react"]) {
        return { id: "vite", label: "Vite", confidence: 0.9 };
      }
      if (dep.vue) return { id: "vue", label: "Vue", confidence: 0.88 };
      if (dep.react || dep["react-dom"]) {
        if (hasAppDir || hasPagesDir) return { id: "nextjs", label: "React (App Router style)", confidence: 0.75 };
        return { id: "react", label: "React", confidence: 0.85 };
      }
      if (dep.express) return { id: "express", label: "Express", confidence: 0.85 };
    } catch {
      /* ignore */
    }
  }

  if (hasHtml && !pkg) return { id: "static", label: "Static HTML", confidence: 0.8 };
  if (hasAppDir || hasPagesDir) return { id: "nextjs", label: "Next.js (structure)", confidence: 0.6 };

  return { id: "unknown", label: "Unknown", confidence: 0.3 };
}

export function detectRoutes(files: ZipImportFile[]): string[] {
  const routes: string[] = [];
  for (const f of files) {
    if (/^app\/page\.(tsx|jsx|js|ts)$/i.test(f.path)) routes.push("/");
    const m = f.path.match(/(?:^|\/)app\/(.+?)\/page\.(tsx|jsx|js|ts)$/i);
    if (m) routes.push("/" + m[1].replace(/\[(\w+)\]/g, ":$1"));
    const p = f.path.match(/(?:^|\/)pages\/(.+?)\.(tsx|jsx|js|ts)$/i);
    if (p && !p[1].startsWith("_")) routes.push("/" + p[1].replace(/index$/i, "").replace(/\/index$/i, ""));
    if (/^index\.html$/i.test(f.path)) routes.push("/");
  }
  return [...new Set(routes)].slice(0, 50);
}
