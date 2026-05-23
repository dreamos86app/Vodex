import { parseJsonFromModel, callProviderStructured } from "@/lib/ai/provider-call";
import { compressProjectContext } from "@/lib/ai/prompt-compressor";
import { buildFileDiffs } from "@/lib/editor/diff";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const EDIT_DIFF_SYSTEM = `You are DreamOS86 code editor. Output strict JSON only.
Given the user request and project files, return minimal patches (not full rewrites).
Return: { "summary": string, "patches": [{ "path": string, "content": string }] }
Max 6 files. No secrets. No provider internals.`;

export async function generateEditDiffPlan(input: {
  writer: SupabaseClient<Database>;
  userId: string;
  userEmail: string | null;
  operationId: string;
  projectId: string;
  userPrompt: string;
  files: Array<{ path: string; content: string }>;
}): Promise<{
  ok: boolean;
  summary: string;
  patches: Array<{ path: string; content: string }>;
  diffs: ReturnType<typeof buildFileDiffs>;
  providerCostUsd: number;
  error?: string;
}> {
  const compressed = compressProjectContext(input.files, new Set());
  const contextFiles = compressed.files.slice(0, 30);

  try {
    const result = await callProviderStructured({
      writer: input.writer,
      userId: input.userId,
      userEmail: input.userEmail,
      operationId: input.operationId,
      operationType: "edit_patch_small",
      system: EDIT_DIFF_SYSTEM,
      prompt: `User request:\n${input.userPrompt}\n\nProject files:\n${JSON.stringify(contextFiles)}`,
      projectId: input.projectId,
      complexity: 5,
    });

    const parsed = parseJsonFromModel<{
      summary?: string;
      patches?: Array<{ path: string; content: string }>;
    }>(result.text);

    const patches = (parsed?.patches ?? []).filter(
      (p) => p.path && typeof p.content === "string" && p.content.length < 150_000,
    );

    if (patches.length === 0) {
      return {
        ok: false,
        summary: "No structured changes produced",
        patches: [],
        diffs: [],
        providerCostUsd: result.providerCostUsd,
        error: "empty_patches",
      };
    }

    const map: Record<string, string> = {};
    for (const f of input.files) map[f.path] = f.content;

    return {
      ok: true,
      summary: parsed?.summary ?? "Proposed edits",
      patches,
      diffs: buildFileDiffs(patches, map),
      providerCostUsd: result.providerCostUsd,
    };
  } catch (e) {
    return {
      ok: false,
      summary: "Edit plan failed",
      patches: [],
      diffs: [],
      providerCostUsd: 0,
      error: e instanceof Error ? e.message : "edit_diff_failed",
    };
  }
}
