export type ShaKeyLabel =
  | "upload_key"
  | "play_signing_key"
  | "legacy_key"
  | "firebase_key"
  | "custom_key";

export type ShaFingerprintEntry = {
  fingerprint: string;
  label: ShaKeyLabel;
  algorithm: "sha256" | "sha1";
  addedAt: string;
};

export type ShaRegistry = {
  sha256: ShaFingerprintEntry[];
  sha1: ShaFingerprintEntry[];
};

const LABELS: ShaKeyLabel[] = [
  "upload_key",
  "play_signing_key",
  "legacy_key",
  "firebase_key",
  "custom_key",
];

export function normalizeFingerprint(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

export function isValidShaFingerprint(fp: string, algorithm: "sha256" | "sha1"): boolean {
  const n = normalizeFingerprint(fp);
  if (algorithm === "sha256") {
    return /^[0-9A-F]{64}$/.test(n) || /^([0-9A-F]{2}:){19}[0-9A-F]{2}$/.test(n);
  }
  return /^[0-9A-F]{40}$/.test(n) || /^([0-9A-F]{2}:){19}[0-9A-F]{2}$/.test(n);
}

function parseLines(text: string, algorithm: "sha256" | "sha1", defaultLabel: ShaKeyLabel): ShaFingerprintEntry[] {
  return text
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const labelMatch = LABELS.find((l) => line.toLowerCase().startsWith(`${l}:`));
      if (labelMatch) {
        const fp = line.slice(labelMatch.length + 1).trim();
        return {
          fingerprint: normalizeFingerprint(fp),
          label: labelMatch,
          algorithm,
          addedAt: new Date().toISOString(),
        };
      }
      return {
        fingerprint: normalizeFingerprint(line),
        label: defaultLabel,
        algorithm,
        addedAt: new Date().toISOString(),
      };
    })
    .filter((e) => isValidShaFingerprint(e.fingerprint, algorithm));
}

export function readShaRegistry(storeDraft: Record<string, unknown> | null | undefined): ShaRegistry {
  const draft = storeDraft ?? {};
  const structured256 = Array.isArray(draft.play_sha256_entries)
    ? (draft.play_sha256_entries as ShaFingerprintEntry[])
    : null;
  const structured1 = Array.isArray(draft.play_sha1_entries)
    ? (draft.play_sha1_entries as ShaFingerprintEntry[])
    : null;

  if (structured256 || structured1) {
    return {
      sha256: structured256 ?? [],
      sha1: structured1 ?? [],
    };
  }

  const legacy256 = Array.isArray(draft.play_sha256_fingerprints)
    ? (draft.play_sha256_fingerprints as string[])
    : [];
  const legacy1 = Array.isArray(draft.play_sha1_fingerprints)
    ? (draft.play_sha1_fingerprints as string[])
    : [];

  return {
    sha256: legacy256.flatMap((fp) =>
      parseLines(fp, "sha256", "upload_key").length
        ? parseLines(fp, "sha256", "upload_key")
        : isValidShaFingerprint(fp, "sha256")
          ? [
              {
                fingerprint: normalizeFingerprint(fp),
                label: "upload_key",
                algorithm: "sha256",
                addedAt: new Date().toISOString(),
              },
            ]
          : [],
    ),
    sha1: legacy1.flatMap((fp) =>
      isValidShaFingerprint(fp, "sha1")
        ? [
            {
              fingerprint: normalizeFingerprint(fp),
              label: "upload_key",
              algorithm: "sha1",
              addedAt: new Date().toISOString(),
            },
          ]
        : [],
    ),
  };
}

export function mergeShaRegistry(
  current: ShaRegistry,
  incoming: { sha256Text: string; sha1Text: string; defaultLabel?: ShaKeyLabel },
): { registry: ShaRegistry; duplicates: string[]; invalid: string[] } {
  const label = incoming.defaultLabel ?? "upload_key";
  const new256 = parseLines(incoming.sha256Text, "sha256", label);
  const new1 = parseLines(incoming.sha1Text, "sha1", label);
  const invalid: string[] = [];
  const duplicates: string[] = [];

  const all256 = new Set(current.sha256.map((e) => e.fingerprint));
  const merged256 = [...current.sha256];
  for (const e of new256) {
    if (all256.has(e.fingerprint)) {
      duplicates.push(e.fingerprint);
      continue;
    }
    all256.add(e.fingerprint);
    merged256.push(e);
  }

  const all1 = new Set(current.sha1.map((e) => e.fingerprint));
  const merged1 = [...current.sha1];
  for (const e of new1) {
    if (all1.has(e.fingerprint)) {
      duplicates.push(e.fingerprint);
      continue;
    }
    all1.add(e.fingerprint);
    merged1.push(e);
  }

  return {
    registry: { sha256: merged256, sha1: merged1 },
    duplicates,
    invalid,
  };
}

export function shaRegistryToStoreDraft(registry: ShaRegistry): Record<string, unknown> {
  return {
    play_sha256_entries: registry.sha256,
    play_sha1_entries: registry.sha1,
    play_sha256_fingerprints: registry.sha256.map((e) => e.fingerprint),
    play_sha1_fingerprints: registry.sha1.map((e) => e.fingerprint),
  };
}

export function exportShaRegistryJson(registry: ShaRegistry): string {
  return JSON.stringify(registry, null, 2);
}
