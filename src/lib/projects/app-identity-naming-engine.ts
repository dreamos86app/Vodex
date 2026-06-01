import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { cleanAppName, stripMarkdownNoise } from "@/lib/projects/clean-app-name";

const BANNED_SUFFIX_RE = /\b(tool|app|platform|management|system|dashboard|builder)\b/i;
const BANNED_GENERIC_RE =
  /^(my app|dashboard|saas app|untitled|new app|dream app|application|platform|builder)$/i;

const BRAND_POOL = [
  "Lumis",
  "SlotNest",
  "FlowDesk",
  "Zenora",
  "Solara",
  "Nexvio",
  "Arcly",
  "Velora",
  "Quantix",
  "Orbital",
  "NovaGrid",
  "Kairo",
  "Mintlane",
  "Craftly",
  "Northly",
  "Pulseo",
  "Rivv",
  "Tidely",
  "Vantix",
  "Zephr",
];

export async function loadRecentAppNames(
  writer: SupabaseClient<Database> | undefined,
  userId: string,
  limit = 40,
): Promise<string[]> {
  if (!writer) return [];
  const { data } = await writer
    .from("projects")
    .select("app_name, name")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  const names: string[] = [];
  for (const row of data ?? []) {
    const n =
      (typeof row.app_name === "string" && row.app_name.trim()) ||
      (typeof row.name === "string" && row.name.trim()) ||
      "";
    if (n) names.push(n);
  }
  return names;
}

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function rejectsRecentName(candidate: string, recent: string[]): boolean {
  const key = normalizeNameKey(candidate);
  if (!key || key.length < 3) return true;
  for (const prev of recent) {
    const pk = normalizeNameKey(prev);
    if (!pk) continue;
    if (pk === key) return true;
    if (pk.length >= 4 && key.startsWith(pk.slice(0, 4))) return true;
    if (key.length >= 4 && pk.startsWith(key.slice(0, 4))) return true;
  }
  return false;
}

export function scoreBrandableName(name: string, intent: string): number {
  const cleaned = cleanAppName(stripMarkdownNoise(name), intent);
  if (!cleaned || cleaned.length < 3 || cleaned.length > 20) return 0;
  if (BANNED_GENERIC_RE.test(cleaned)) return 0;
  if (BANNED_SUFFIX_RE.test(cleaned)) return 0;
  if (intent.trim().toLowerCase().includes(cleaned.toLowerCase()) && cleaned.length > 6) return 0;
  let score = 50;
  if (/^[A-Z][a-z]+[A-Z]/.test(cleaned)) score += 20;
  if (cleaned.length >= 4 && cleaned.length <= 12) score += 15;
  if (!/\s/.test(cleaned)) score += 10;
  return score;
}

export function pickUniqueBrandName(recent: string[], intent: string): string {
  for (const candidate of BRAND_POOL) {
    if (!rejectsRecentName(candidate, recent) && scoreBrandableName(candidate, intent) > 40) {
      return candidate;
    }
  }
  const suffix = String(Math.floor(Math.random() * 89) + 10);
  const base = BRAND_POOL[Math.floor(Math.random() * BRAND_POOL.length)] ?? "Velora";
  const hybrid = `${base.slice(0, 5)}${suffix}`;
  if (!rejectsRecentName(hybrid, recent)) return hybrid;
  return `Velora${suffix}`;
}

export function validateGeneratedName(
  candidate: string,
  intent: string,
  recent: string[],
): string | null {
  const cleaned = cleanAppName(stripMarkdownNoise(candidate), intent);
  if (scoreBrandableName(cleaned, intent) < 40) return null;
  if (rejectsRecentName(cleaned, recent)) return null;
  return cleaned;
}
