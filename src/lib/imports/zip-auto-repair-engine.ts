import type { ZipImportFile } from "@/lib/import/zip-file-validator";
import { detectImportedFramework } from "@/lib/imports/framework-detector";
import type {
  ZipAutoRepairAction,
  ZipAutoRepairMetadata,
  ZipAutoRepairResult,
} from "@/lib/imports/zip-auto-repair-types";

function norm(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function hasPath(files: Map<string, ZipImportFile>, path: string): boolean {
  return files.has(norm(path));
}

function getContent(files: Map<string, ZipImportFile>, path: string): string | null {
  return files.get(norm(path))?.content ?? null;
}

function upsert(
  files: Map<string, ZipImportFile>,
  path: string,
  content: string,
  actions: ZipAutoRepairAction[],
  reason: string,
): void {
  const p = norm(path);
  const existed = files.has(p);
  const sizeBytes = Buffer.byteLength(content, "utf8");
  files.set(p, { path: p, content, sizeBytes });
  actions.push({ path: p, action: existed ? "modified" : "created", reason });
}

function ensureUseClient(
  files: Map<string, ZipImportFile>,
  path: string,
  actions: ZipAutoRepairAction[],
): void {
  const p = norm(path);
  const file = files.get(p);
  if (!file) return;
  if (/^["']use client["'];?\s*$/m.test(file.content.trimStart().slice(0, 40))) return;
  upsert(files, p, `"use client";\n\n${file.content}`, actions, "Next.js client boundary required");
}

const DEFAULT_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": false,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "~/*": ["./*"],
      "src/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`;

const NEXT_ENV_DTS = `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`;

const DEFAULT_NEXT_CONFIG = `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

module.exports = nextConfig;
`;

const DEFAULT_VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: false,
    minify: 'esbuild',
    chunkSizeWarningLimit: 2000,
  },
});
`;

const DEFAULT_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const DEFAULT_MAIN_TSX = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`;

function readPkg(files: Map<string, ZipImportFile>): Record<string, unknown> | null {
  const raw = getContent(files, "package.json");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function writePkg(
  files: Map<string, ZipImportFile>,
  pkg: Record<string, unknown>,
  actions: ZipAutoRepairAction[],
): void {
  upsert(files, "package.json", `${JSON.stringify(pkg, null, 2)}\n`, actions, "package.json scripts/deps");
}

function repairNext(
  files: Map<string, ZipImportFile>,
  actions: ZipAutoRepairAction[],
  warnings: string[],
  blockers: string[],
): void {
  if (!hasPath(files, "tsconfig.json")) {
    upsert(files, "tsconfig.json", DEFAULT_TSCONFIG, actions, "Missing tsconfig.json — added path aliases for @/*");
  }
  if (!hasPath(files, "next-env.d.ts")) {
    upsert(files, "next-env.d.ts", NEXT_ENV_DTS, actions, "Missing next-env.d.ts");
  }
  if (!hasPath(files, "next.config.js") && !hasPath(files, "next.config.mjs") && !hasPath(files, "next.config.ts")) {
    upsert(files, "next.config.js", DEFAULT_NEXT_CONFIG, actions, "Missing next.config — added static export defaults");
  }

  for (const p of ["app/error.tsx", "app/global-error.tsx"]) {
    ensureUseClient(files, p, actions);
  }

  const pkg = readPkg(files);
  if (pkg) {
    const scripts = (pkg.scripts as Record<string, string> | undefined) ?? {};
    if (!scripts.build) {
      scripts.build = "next build";
      pkg.scripts = scripts;
      writePkg(files, pkg, actions);
    }
    const deps = { ...((pkg.dependencies as Record<string, string>) ?? {}) };
    let depsChanged = false;
    if (!deps.next) {
      deps.next = "^15.0.0";
      depsChanged = true;
    }
    if (!deps.react) {
      deps.react = "^19.0.0";
      depsChanged = true;
    }
    if (!deps["react-dom"]) {
      deps["react-dom"] = "^19.0.0";
      depsChanged = true;
    }
    if (depsChanged) {
      pkg.dependencies = deps;
      writePkg(files, pkg, actions);
    }
  }

  const referencesMock = [...files.values()].some((f) => /@\/lib\/mock-data/.test(f.content));
  if (referencesMock && !hasPath(files, "lib/mock-data.ts")) {
    blockers.push("Imports reference @/lib/mock-data but lib/mock-data.ts is missing — add the file or remove imports.");
  }

  if (!hasPath(files, "app/page.tsx") && !hasPath(files, "pages/index.tsx") && !hasPath(files, "pages/index.js")) {
    blockers.push("No Next.js entry page (app/page.tsx or pages/index).");
  }
}

function repairVite(
  files: Map<string, ZipImportFile>,
  actions: ZipAutoRepairAction[],
  warnings: string[],
  blockers: string[],
): void {
  if (!hasPath(files, "vite.config.ts") && !hasPath(files, "vite.config.js") && !hasPath(files, "vite.config.mjs")) {
    const useSrc = hasPath(files, "src/App.tsx") || hasPath(files, "src/main.tsx");
    if (useSrc) {
      upsert(files, "vite.config.ts", DEFAULT_VITE_CONFIG, actions, "Missing vite.config — added default with @ alias");
    } else {
      upsert(
        files,
        "vite.config.ts",
        DEFAULT_VITE_CONFIG.replace("./src", "."),
        actions,
        "Missing vite.config — added root alias",
      );
    }
  }

  if (!hasPath(files, "tsconfig.json")) {
    upsert(files, "tsconfig.json", DEFAULT_TSCONFIG, actions, "Missing tsconfig.json for Vite/React");
  }

  if (!hasPath(files, "index.html")) {
    upsert(files, "index.html", DEFAULT_INDEX_HTML, actions, "Missing index.html");
  }

  if (!hasPath(files, "src/main.tsx") && hasPath(files, "src/App.tsx")) {
    upsert(files, "src/main.tsx", DEFAULT_MAIN_TSX, actions, "Missing src/main.tsx entry");
  }

  const pkg = readPkg(files);
  if (pkg) {
    const scripts = (pkg.scripts as Record<string, string> | undefined) ?? {};
    if (!scripts.build) {
      scripts.build = "vite build";
      pkg.scripts = scripts;
      writePkg(files, pkg, actions);
    }
    const deps = { ...((pkg.dependencies as Record<string, string>) ?? {}) };
    const devDeps = { ...((pkg.devDependencies as Record<string, string>) ?? {}) };
    let changed = false;
    if (!deps.react) {
      deps.react = "^19.0.0";
      changed = true;
    }
    if (!deps["react-dom"]) {
      deps["react-dom"] = "^19.0.0";
      changed = true;
    }
    if (!devDeps.vite) {
      devDeps.vite = "^6.0.0";
      changed = true;
    }
    if (!devDeps["@vitejs/plugin-react"]) {
      devDeps["@vitejs/plugin-react"] = "^4.3.0";
      changed = true;
    }
    if (changed) {
      pkg.dependencies = deps;
      pkg.devDependencies = devDeps;
      writePkg(files, pkg, actions);
    }
  }

  if (!hasPath(files, "index.html") && !hasPath(files, "src/main.tsx") && !hasPath(files, "src/App.tsx")) {
    blockers.push("No Vite entry (index.html + src/main.tsx or src/App.tsx).");
  }
}

/** Normalize imported ZIP source before preview worker build. */
export function runZipAutoRepairEngine(files: ZipImportFile[]): ZipAutoRepairResult {
  const fileMap = new Map<string, ZipImportFile>();
  for (const f of files) {
    fileMap.set(norm(f.path), { ...f, path: norm(f.path) });
  }

  const framework = detectImportedFramework(files);
  const actions: ZipAutoRepairAction[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];

  const fw = framework.id;

  if (fw === "unknown" && !hasPath(fileMap, "index.html")) {
    blockers.push("Unsupported or unknown framework — no package.json or index.html entry.");
  } else if (fw === "nextjs_app" || fw === "nextjs_pages") {
    repairNext(fileMap, actions, warnings, blockers);
    if (framework.isSsrNext && !framework.scripts.export) {
      warnings.push("Next.js SSR detected — worker will attempt static export patch before build.");
    }
  } else if (
    fw === "vite" ||
    fw === "react" ||
    fw === "cra" ||
    fw === "base44" ||
    fw === "lovable" ||
    fw === "bolt" ||
    fw === "v0"
  ) {
    repairVite(fileMap, actions, warnings, blockers);
  } else if (fw === "static") {
    if (!hasPath(fileMap, "index.html")) {
      blockers.push("Static site missing index.html");
    }
  }

  const modifiedPaths = [...new Set(actions.map((a) => a.path))];
  const canBuild = blockers.length === 0 && fileMap.size > 0;

  return {
    repairedFiles: [...fileMap.values()],
    repairActions: actions,
    warnings,
    blockers,
    canBuild,
    framework: fw,
    confidence: framework.confidence,
    modifiedPaths,
  };
}

export function zipAutoRepairMetadata(result: ZipAutoRepairResult): ZipAutoRepairMetadata {
  return {
    actions: result.repairActions,
    warnings: result.warnings,
    blockers: result.blockers,
    timestamp: new Date().toISOString(),
    framework: result.framework,
    confidence: result.confidence,
    canBuild: result.canBuild,
  };
}
