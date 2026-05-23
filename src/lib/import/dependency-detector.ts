import type { ZipImportFile } from "@/lib/import/zip-file-validator";

export type DependencySummary = {
  production: string[];
  dev: string[];
  hasSupabase: boolean;
  hasStripe: boolean;
  hasFirebase: boolean;
  hasPrisma: boolean;
  hasTailwind: boolean;
};

export function detectDependencies(files: ZipImportFile[]): DependencySummary {
  const pkg = files.find((f) => f.path === "package.json" || f.path.endsWith("/package.json"));
  const empty: DependencySummary = {
    production: [],
    dev: [],
    hasSupabase: false,
    hasStripe: false,
    hasFirebase: false,
    hasPrisma: false,
    hasTailwind: false,
  };
  if (!pkg) return empty;
  try {
    const j = JSON.parse(pkg.content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const prod = Object.keys(j.dependencies ?? {});
    const dev = Object.keys(j.devDependencies ?? {});
    const all = [...prod, ...dev].map((d) => d.toLowerCase());
    return {
      production: prod.slice(0, 40),
      dev: dev.slice(0, 40),
      hasSupabase: all.some((d) => d.includes("supabase")),
      hasStripe: all.some((d) => d.includes("stripe")),
      hasFirebase: all.some((d) => d.includes("firebase")),
      hasPrisma: all.some((d) => d.includes("prisma")),
      hasTailwind: all.some((d) => d.includes("tailwind")),
    };
  } catch {
    return empty;
  }
}
