import { parseJsonFromModel, callProviderStructured } from "@/lib/ai/provider-call";
import { compressProjectContext } from "@/lib/ai/prompt-compressor";
import { scoreAppQuality } from "@/lib/quality/app-quality-score";
import { buildFileDiffs } from "@/lib/editor/diff";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const POLISH_SYSTEM = `You are DreamOS86 UI polish engine. Output strict JSON only.
Improve spacing, responsive layout, empty states, loading states, error copy, and basic accessibility.
Do NOT rewrite architecture. Touch at most 8 files. No secrets. No deployment claims.
Return: { "summary": string, "patches": [{ "path": string, "content": string }] }`;

export async function generatePolishPatches(input: {
  writer: SupabaseClient<Database>;
  userId: string;
  userEmail: string | null;
  operationId: string;
  projectId: string;
  files: Array<{ path: string; content: string }>;
}): Promise<{
  ok: boolean;
  summary: string;
  patches: Array<{ path: string; content: string }>;
  diffs: ReturnType<typeof buildFileDiffs>;
  providerCostUsd: number;
  qualityBefore: number;
  qualityAfterEstimate: number;
  error?: string;
}> {
  const quality = scoreAppQuality({
    files: input.files,
    hasAuth: input.files.some((f) => /auth|login/i.test(f.path + f.content)),
    hasLoadingStates: input.files.some((f) => /loading|skeleton/i.test(f.content)),
  });

  const failed = quality.checks.filter((c) => !c.passed);
  const compressed = compressProjectContext(input.files, new Set());
  const contextFiles = compressed.files.slice(0, 24);

  const userPrompt = [
    `Quality score: ${quality.scorePercent}%`,
    `Fix these areas: ${failed.map((c) => c.label).join(", ") || "general polish"}`,
    `Files:\n${JSON.stringify(contextFiles)}`,
  ].join("\n\n");

  try {
    const result = await callProviderStructured({
      writer: input.writer,
      userId: input.userId,
      userEmail: input.userEmail,
      operationId: input.operationId,
      operationType: "edit_patch_small",
      system: POLISH_SYSTEM,
      prompt: userPrompt,
      projectId: input.projectId,
      complexity: 4,
    });

    const parsed = parseJsonFromModel<{
      summary?: string;
      patches?: Array<{ path: string; content: string }>;
    }>(result.text);

    const patches = (parsed?.patches ?? []).filter(
      (p) => p.path && typeof p.content === "string" && p.content.length < 120_000,
    );

    if (patches.length === 0) {
      return {
        ok: false,
        summary: "No polish patches generated",
        patches: [],
        diffs: [],
        providerCostUsd: result.providerCostUsd,
        qualityBefore: quality.scorePercent,
        qualityAfterEstimate: quality.scorePercent,
        error: "empty_patches",
      };
    }

    const map: Record<string, string> = {};
    for (const f of input.files) map[f.path] = f.content;
    const diffs = buildFileDiffs(patches, map);

    return {
      ok: true,
      summary: parsed?.summary ?? "Polish recommended issues",
      patches,
      diffs,
      providerCostUsd: result.providerCostUsd,
      qualityBefore: quality.scorePercent,
      qualityAfterEstimate: Math.min(100, quality.scorePercent + 8),
    };
  } catch (e) {
    return {
      ok: false,
      summary: "Polish failed",
      patches: [],
      diffs: [],
      providerCostUsd: 0,
      qualityBefore: quality.scorePercent,
      qualityAfterEstimate: quality.scorePercent,
      error: e instanceof Error ? e.message : "polish_failed",
    };
  }
}
