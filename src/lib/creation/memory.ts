/**
 * DreamOS86 — Project memory engine.
 *
 * The AI must remember a project's architecture, design system, stack
 * choices, and prior decisions across sessions. We persist these in
 * `public.project_memory` (one row per (project, category, key)) and
 * inject the most-important rows into every model call as a structured
 * system block.
 *
 * Memory is REAL: it's queried from Supabase, scoped via RLS, written
 * with explicit upsert calls. There is no fake recall.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type MemoryCategory =
  | "architecture"
  | "visual_identity"
  | "code_evolution"
  | "deployment"
  | "preferences"
  | "workflow"
  | "components"
  | "design_system"
  | "intent"
  | "file_relationships";

export interface MemoryEntry {
  category: MemoryCategory;
  key: string;
  value: unknown;
  importance?: number; // 1-10, defaults to 5
}

export const MEMORY_CATEGORIES: ReadonlyArray<MemoryCategory> = [
  "architecture",
  "visual_identity",
  "code_evolution",
  "deployment",
  "preferences",
  "workflow",
  "components",
  "design_system",
  "intent",
  "file_relationships",
];

/**
 * Upsert a single memory entry. Idempotent on (project_id, category, key).
 */
export async function recordMemory(
  supabase: SupabaseClient<Database>,
  args: {
    projectId: string;
    userId: string;
    entry: MemoryEntry;
  },
) {
  const { projectId, userId, entry } = args;
  const { error } = await supabase.from("project_memory").upsert(
    {
      project_id: projectId,
      user_id: userId,
      category: entry.category,
      key: entry.key,
      value: entry.value as never,
      importance: entry.importance ?? 5,
    },
    { onConflict: "project_id,category,key" },
  );
  return { error };
}

export async function recordMemoryBatch(
  supabase: SupabaseClient<Database>,
  args: { projectId: string; userId: string; entries: MemoryEntry[] },
) {
  if (args.entries.length === 0) return { error: null };
  const rows = args.entries.map((e) => ({
    project_id: args.projectId,
    user_id: args.userId,
    category: e.category,
    key: e.key,
    value: e.value as never,
    importance: e.importance ?? 5,
  }));
  const { error } = await supabase
    .from("project_memory")
    .upsert(rows, { onConflict: "project_id,category,key" });
  return { error };
}

/**
 * Load the top-N most important memory rows for a project, ordered by
 * importance descending.
 */
export async function loadMemory(
  supabase: SupabaseClient<Database>,
  args: { projectId: string; limit?: number },
) {
  const { data, error } = await supabase
    .from("project_memory")
    .select("category, key, value, importance, updated_at")
    .eq("project_id", args.projectId)
    .order("importance", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(args.limit ?? 40);
  if (error) return { entries: [], error };
  return {
    entries: (data ?? []) as Array<{
      category: MemoryCategory;
      key: string;
      value: unknown;
      importance: number;
      updated_at: string;
    }>,
    error: null,
  };
}

/**
 * Render memory as a compact, deterministic markdown block suitable for
 * injecting into a system prompt. Token-conscious: ~50 tokens per row.
 */
export function formatMemoryForPrompt(
  entries: ReadonlyArray<{ category: MemoryCategory; key: string; value: unknown }>,
): string {
  if (entries.length === 0) return "";
  const grouped = new Map<MemoryCategory, Array<{ key: string; value: unknown }>>();
  for (const e of entries) {
    if (!grouped.has(e.category)) grouped.set(e.category, []);
    grouped.get(e.category)!.push({ key: e.key, value: e.value });
  }

  const lines: string[] = ["## Project memory (persistent context)"];
  for (const [category, rows] of grouped) {
    lines.push(`\n### ${category.replace(/_/g, " ")}`);
    for (const r of rows) {
      const v =
        typeof r.value === "string"
          ? r.value
          : JSON.stringify(r.value);
      lines.push(`- **${r.key}**: ${v}`);
    }
  }
  return lines.join("\n");
}
