import type { ZipImportFile } from "@/lib/import/zip-file-validator";

export type EnvRequirement = {
  key: string;
  source: "example" | "code" | "schema";
  public: boolean;
};

const ENV_KEY_RE = /process\.env\.([A-Z][A-Z0-9_]{2,})/g;
const IMPORT_META_RE = /import\.meta\.env\.([A-Z][A-Z0-9_]{2,})/g;
const VITE_RE = /VITE_[A-Z0-9_]+/g;
const NEXT_PUBLIC_RE = /NEXT_PUBLIC_[A-Z0-9_]+/g;

export function detectEnvRequirements(files: ZipImportFile[]): EnvRequirement[] {
  const found = new Map<string, EnvRequirement>();

  for (const f of files) {
    if (/\.env\.example$/i.test(f.path)) {
      for (const line of f.content.split("\n")) {
        const m = line.match(/^([A-Z][A-Z0-9_]*)=/);
        if (m) found.set(m[1], { key: m[1], source: "example", public: m[1].startsWith("NEXT_PUBLIC_") });
      }
    }
    if (/\.(tsx?|jsx?|js|mjs|vue|svelte)$/.test(f.path)) {
      let m: RegExpExecArray | null;
      ENV_KEY_RE.lastIndex = 0;
      while ((m = ENV_KEY_RE.exec(f.content))) {
        const key = m[1];
        if (!found.has(key)) {
          found.set(key, { key, source: "code", public: key.startsWith("NEXT_PUBLIC_") });
        }
      }
      IMPORT_META_RE.lastIndex = 0;
      while ((m = IMPORT_META_RE.exec(f.content))) {
        const key = m[1];
        if (!found.has(key)) {
          found.set(key, { key, source: "code", public: key.startsWith("VITE_") || key.startsWith("NEXT_PUBLIC_") });
        }
      }
      for (const pub of f.content.match(NEXT_PUBLIC_RE) ?? []) {
        if (!found.has(pub)) found.set(pub, { key: pub, source: "code", public: true });
      }
      for (const vite of f.content.match(VITE_RE) ?? []) {
        if (!found.has(vite)) found.set(vite, { key: vite, source: "code", public: true });
      }
    }
  }

  return [...found.values()].slice(0, 30);
}
