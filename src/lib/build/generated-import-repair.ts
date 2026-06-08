/**
 * P1.3.17 — Import graph validation + repair for generated apps (@/ alias + mock-data).
 */
import {
  findAllMissingImports,
  type MissingImport,
} from "@/lib/build/import-graph";
import {
  filterRenderableBuildFiles,
  normalizeBuildFilePath,
  type BuildFile,
} from "@/lib/build/generated-file-utils";

const EXPORT_IMPORT_RE =
  /import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+))\s+from\s+['"]@\/([^'"]+)['"]/g;

function parseNamedImports(statement: string): string[] {
  const names: string[] = [];
  const brace = statement.match(/\{([^}]+)\}/);
  if (brace) {
    for (const part of brace[1]!.split(",")) {
      const n = part.trim().split(/\s+as\s+/)[0]?.trim();
      if (n) names.push(n);
    }
  } else {
    const def = statement.match(/import\s+(\w+)\s+from/);
    if (def) names.push(def[1]!);
  }
  return names;
}

function collectMockDataExportsNeeded(files: BuildFile[]): Set<string> {
  const needed = new Set<string>();
  for (const file of files) {
    if (!/\.(tsx|jsx|ts|js)$/i.test(file.path)) continue;
    let m: RegExpExecArray | null;
    EXPORT_IMPORT_RE.lastIndex = 0;
    while ((m = EXPORT_IMPORT_RE.exec(file.content)) !== null) {
      const spec = m[3];
      if (!spec || !/^lib\/mock-data/i.test(spec)) continue;
      const names = parseNamedImports(m[0]);
      for (const n of names) needed.add(n);
    }
  }
  if (!needed.size) {
    needed.add("metrics");
    needed.add("recentItems");
  }
  return needed;
}

function synthesizeMockDataTs(exports: Set<string>): string {
  const lines: string[] = [];
  if (exports.has("metrics")) {
    lines.push(`export const metrics = [
  { label: "Monthly spend", value: "$2,840" },
  { label: "Savings rate", value: "18%" },
  { label: "Active goals", value: "4" },
  { label: "Alerts", value: "2" },
];`);
  }
  if (exports.has("recentItems")) {
    lines.push(`export const recentItems = [
  { id: "1", title: "Grocery run", status: "Posted", updated: "Today" },
  { id: "2", title: "Rent transfer", status: "Scheduled", updated: "Tomorrow" },
  { id: "3", title: "Subscription audit", status: "Review", updated: "This week" },
];`);
  }
  for (const name of exports) {
    if (name === "metrics" || name === "recentItems") continue;
    const sample =
      name.toLowerCase().includes("metric") || name.toLowerCase().includes("stat")
        ? `[{ label: "Sample", value: "12" }]`
        : `[{ id: "1", title: "Sample ${name}", status: "Active" }]`;
    lines.push(`export const ${name} = ${sample};`);
  }
  return `${lines.join("\n\n")}\n`;
}

export function ensureGeneratedTsconfig(files: BuildFile[]): BuildFile[] {
  const byPath = new Map(files.map((f) => [normalizeBuildFilePath(f.path), f]));
  const path = "tsconfig.json";
  const existing = byPath.get(path);
  const required = {
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./*"] },
      jsx: "preserve",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: false,
      noEmit: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      incremental: true,
      plugins: [{ name: "next" }],
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
    exclude: ["node_modules"],
  };
  if (!existing?.content?.includes('"@/*"')) {
    byPath.set(path, { path, content: `${JSON.stringify(required, null, 2)}\n` });
  }
  return [...byPath.values()];
}

export type ImportGraphRepairResult = {
  files: BuildFile[];
  missingBefore: MissingImport[];
  missingAfter: MissingImport[];
  repaired: boolean;
  status: "pass" | "repaired" | "fail";
};

export function repairGeneratedImportGraph(files: BuildFile[]): ImportGraphRepairResult {
  let working = filterRenderableBuildFiles(files);
  working = ensureGeneratedTsconfig(working);
  const missingBefore = findAllMissingImports(working);

  const byPath = new Map(working.map((f) => [normalizeBuildFilePath(f.path), f]));

  const needsMockData = missingBefore.some(
    (m) => m.resolvedPath?.includes("lib/mock-data") || m.specifier.includes("mock-data"),
  );
  if (needsMockData && !byPath.has("lib/mock-data.ts")) {
    const exports = collectMockDataExportsNeeded(working);
    byPath.set("lib/mock-data.ts", {
      path: "lib/mock-data.ts",
      content: synthesizeMockDataTs(exports),
    });
  }

  for (const mi of missingBefore) {
    if (!mi.resolvedPath) continue;
    const norm = normalizeBuildFilePath(mi.resolvedPath);
    if (byPath.has(norm) || byPath.has(`${norm}.ts`) || byPath.has(`${norm}.tsx`)) continue;
    const base = norm.split("/").pop() ?? "Module";
    const name = base.replace(/\.(tsx|ts|jsx|js)$/i, "");
    const path = /\.(tsx|ts|jsx|js)$/i.test(norm) ? norm : `${norm}.ts`;
    if (!byPath.has(path)) {
      byPath.set(path, {
        path,
        content: `export const ${name} = {};\nexport default ${name};\n`,
      });
    }
  }

  working = [...byPath.values()];
  const missingAfter = findAllMissingImports(working);
  const repaired = missingBefore.length > 0 && missingAfter.length < missingBefore.length;
  const status =
    missingAfter.length === 0 ? (repaired ? "repaired" : "pass") : "fail";

  return {
    files: working,
    missingBefore,
    missingAfter,
    repaired,
    status,
  };
}

export function formatMissingImportsForSummary(imports: MissingImport[]): string[] {
  return imports.slice(0, 12).map((m) => `${m.fromFile} → ${m.specifier}`);
}
