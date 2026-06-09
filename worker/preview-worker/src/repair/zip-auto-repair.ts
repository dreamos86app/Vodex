/**
 * Worker-side ZIP repair — mirrors platform zip-auto-repair-engine essentials.
 */
import type { WorkspaceFile } from "../sandbox.js";

export type RepairAction = { path: string; action: "created" | "modified"; reason: string };

export type WorkerZipRepairResult = {
  files: WorkspaceFile[];
  actions: RepairAction[];
  warnings: string[];
  blockers: string[];
  canBuild: boolean;
};

function norm(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function mapFiles(files: WorkspaceFile[]): Map<string, WorkspaceFile> {
  const m = new Map<string, WorkspaceFile>();
  for (const f of files) m.set(norm(f.path), { path: norm(f.path), content: f.content });
  return m;
}

function upsert(
  m: Map<string, WorkspaceFile>,
  path: string,
  content: string,
  actions: RepairAction[],
  reason: string,
): void {
  const p = norm(path);
  const existed = m.has(p);
  m.set(p, { path: p, content });
  actions.push({ path: p, action: existed ? "modified" : "created", reason });
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
    "paths": { "@/*": ["./*"], "~/*": ["./*"], "src/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
`;

const DEFAULT_NEXT_CONFIG = `/** @type {import('next').NextConfig} */
module.exports = {
  output: 'export',
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};
`;

function detectNext(files: Map<string, WorkspaceFile>): boolean {
  return (
    files.has("app/page.tsx") ||
    files.has("app/page.jsx") ||
    [...files.keys()].some((p) => p.startsWith("app/") && p.endsWith("page.tsx"))
  );
}

function detectVite(files: Map<string, WorkspaceFile>): boolean {
  return (
    files.has("vite.config.ts") ||
    files.has("vite.config.js") ||
    files.has("index.html") ||
    files.has("src/main.tsx")
  );
}

export function runWorkerZipAutoRepair(files: WorkspaceFile[]): WorkerZipRepairResult {
  const m = mapFiles(files);
  const actions: RepairAction[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];

  const isNext = detectNext(m);
  const isVite = detectVite(m);

  if (isNext) {
    if (!m.has("tsconfig.json")) {
      upsert(m, "tsconfig.json", DEFAULT_TSCONFIG, actions, "worker: added tsconfig.json");
    }
    if (!m.has("next-env.d.ts")) {
      upsert(m, "next-env.d.ts", '/// <reference types="next" />\n', actions, "worker: next-env.d.ts");
    }
    if (!m.has("next.config.js") && !m.has("next.config.mjs") && !m.has("next.config.ts")) {
      upsert(m, "next.config.js", DEFAULT_NEXT_CONFIG, actions, "worker: next.config.js");
    }
    for (const p of ["app/error.tsx", "app/global-error.tsx"]) {
      const f = m.get(p);
      if (f && !f.content.includes("use client")) {
        upsert(m, p, `"use client";\n\n${f.content}`, actions, "worker: use client directive");
      }
    }
  } else if (isVite) {
    if (!m.has("tsconfig.json")) {
      upsert(m, "tsconfig.json", DEFAULT_TSCONFIG, actions, "worker: tsconfig for vite");
    }
    if (!m.has("vite.config.ts") && !m.has("vite.config.js")) {
      upsert(
        m,
        "vite.config.ts",
        `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });\n`,
        actions,
        "worker: vite.config.ts",
      );
    }
    if (!m.has("index.html")) {
      upsert(
        m,
        "index.html",
        '<!DOCTYPE html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
        actions,
        "worker: index.html",
      );
    }
  } else if (!m.has("index.html") && !m.has("package.json")) {
    blockers.push("Unsupported framework for worker build");
  }

  return {
    files: [...m.values()],
    actions,
    warnings,
    blockers,
    canBuild: blockers.length === 0,
  };
}
