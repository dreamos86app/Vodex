import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { parseFencedFiles } from "@/lib/creation/extract-fenced-code";
import { FILE_PAYLOAD_RULE } from "@/lib/build/stage-prompts";
import { validateGeneratedBuild } from "@/lib/creation/validate-build-quality";

export type BuildFile = { path: string; content: string };

export type QualityAssessment = {
  ok: boolean;
  reasons: string[];
};

export function assessBuildQuality(files: BuildFile[]): QualityAssessment {
  const result = validateGeneratedBuild(files);
  return { ok: result.ok, reasons: result.reasons };
}

export function buildRepairPrompt(
  reasons: string[],
  files: BuildFile[],
  userPrompt: string,
): string {
  const preview = files.find((f) => /preview\/index\.html$/i.test(f.path));
  const excerpt = preview?.content.slice(0, 2000) ?? files[0]?.content.slice(0, 1500) ?? "";
  return [
    FILE_PAYLOAD_RULE,
    "The generated app failed quality checks. Repair by adding missing route files and fixing placeholders.",
    `Issues: ${reasons.join("; ")}`,
    `Original user request: ${userPrompt.slice(0, 500)}`,
    "REQUIRED paths: app/page.tsx plus at least 2 routes under app/ (e.g. app/dashboard/page.tsx).",
    "No Sample Item, no generic two-button placeholders, no lorem ipsum.",
    excerpt ? `\nCurrent preview excerpt:\n${excerpt}` : "",
  ].join("\n");
}

export type RepairPassResult = {
  repaired: boolean;
  fileCount: number;
  reasons: string[];
  attempts: number;
};

/**
 * Run up to `maxAttempts` non-streaming repair passes after initial build save.
 */
export async function runBuildQualityRepair({
  generate,
  writer,
  projectId,
  buildJobId,
  userId,
  files,
  userPrompt,
  maxAttempts = 2,
}: {
  generate: (prompt: string) => Promise<string>;
  writer: SupabaseClient;
  projectId: string;
  buildJobId: string | null;
  userId: string;
  files: BuildFile[];
  userPrompt: string;
  maxAttempts?: number;
}): Promise<RepairPassResult> {
  let current = [...files];
  let attempts = 0;

  for (let i = 0; i < maxAttempts; i++) {
    const assessment = assessBuildQuality(current);
    if (assessment.ok) {
      return { repaired: i > 0, fileCount: current.length, reasons: [], attempts };
    }

    attempts += 1;
    if (buildJobId) {
      await writer
        .from("build_jobs")
        .update({
          status: "repairing",
          error_message: `Quality repair attempt ${attempts}: ${assessment.reasons.join(", ")}`,
        } as never)
        .eq("id", buildJobId);
    }

    const repairText = await generate(
      buildRepairPrompt(assessment.reasons, current, userPrompt),
    );
    const repaired = parseFencedFiles(repairText);
    if (repaired.length === 0) {
      return {
        repaired: false,
        fileCount: current.length,
        reasons: assessment.reasons,
        attempts,
      };
    }

    const merged = new Map(current.map((f) => [f.path, f.content]));
    for (const f of repaired) merged.set(f.path, f.content);
    current = [...merged.entries()].map(([path, content]) => ({ path, content }));

    const rows = current.map((f) => ({
      project_id: projectId,
      path: f.path,
      content: f.content,
      mime_type: "text/plain",
      size_bytes: Buffer.byteLength(f.content, "utf8"),
    }));
    await writer.from("app_files").upsert(rows, { onConflict: "project_id,path" });

    for (const reason of assessment.reasons) {
      await writer.from("preview_errors").insert({
        project_id: projectId,
        build_id: buildJobId,
        severity: "warning",
        message: reason,
        file_path: "preview/index.html",
      } as never);
    }
  }

  const final = assessBuildQuality(current);
  return {
    repaired: final.ok,
    fileCount: current.length,
    reasons: final.reasons,
    attempts,
  };
}
