import type { ZipImportFile } from "@/lib/import/zip-file-validator";

export type LegacyPlatform = "base44" | "lovable" | "bolt" | "v0" | null;

export type LegacyPlatformInfo = {
  platform: LegacyPlatform;
  usesBase44Sdk: boolean;
  base44EnvKeys: string[];
  message: string | null;
};

const BASE44_RE =
  /@base44\/|base44\.dev|BASE44_|from\s+['"]base44|createBase44|Base44Client/i;

export function detectLegacyPlatform(files: ZipImportFile[]): LegacyPlatformInfo {
  const combined = files.map((f) => f.content).join("\n");
  const base44EnvKeys = new Set<string>();

  for (const f of files) {
    for (const line of f.content.split("\n")) {
      const m = line.match(/^(BASE44_[A-Z0-9_]+)=/);
      if (m) base44EnvKeys.add(m[1]!);
    }
    if (/BASE44_[A-Z0-9_]+/.test(f.content)) {
      const matches = f.content.match(/BASE44_[A-Z0-9_]+/g) ?? [];
      matches.forEach((k) => base44EnvKeys.add(k));
    }
  }

  const usesBase44Sdk = BASE44_RE.test(combined);
  let platform: LegacyPlatform = null;

  if (usesBase44Sdk || base44EnvKeys.size > 0) platform = "base44";
  else if (/lovable\.dev|from\s+['"]lovable/i.test(combined)) platform = "lovable";
  else if (/bolt\.new|@bolt\//i.test(combined)) platform = "bolt";
  else if (/v0\.dev|@v0\//i.test(combined)) platform = "v0";

  let message: string | null = null;
  if (platform === "base44") {
    message =
      "Legacy Base44 dependency detected. Base44 API keys from the original export are not required on Vodex — connect Supabase/GitHub from Integrations if your app needs them.";
  } else if (platform) {
    message = `Imported from ${platform} — Vodex will run the source as a standard web app where possible.`;
  }

  return {
    platform,
    usesBase44Sdk,
    base44EnvKeys: [...base44EnvKeys],
    message,
  };
}

/** Env keys we should not treat as publish blockers unless the SDK is present. */
export function isIgnorableLegacyEnvKey(key: string, legacy: LegacyPlatformInfo): boolean {
  if (/^VITE_BASE44_/i.test(key)) return legacy.platform === "base44";
  if (!key.startsWith("BASE44_")) return false;
  return legacy.platform === "base44" && !legacy.usesBase44Sdk;
}
