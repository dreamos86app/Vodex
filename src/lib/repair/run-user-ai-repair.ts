import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { randomUUID } from "crypto";
import {
  assessBuildQuality,
  buildRepairPrompt,
  type BuildFile,
} from "@/lib/build/quality-repair";
import { parseFencedFiles } from "@/lib/creation/extract-fenced-code";
import { callProviderStructured } from "@/lib/ai/provider-call";
import { quoteGenerationCost } from "@/lib/billing/credit-profit-guard";
import {
  reconcileGenerationReservation,
  reserveCreditsForGeneration,
} from "@/lib/billing/credit-reservations";
import { reconcileProjectLifecycle } from "@/lib/projects/reconcile-lifecycle";
import { saveProjectCheckpoint } from "@/lib/repair/save-checkpoint";
import { lifecyclePatch, legacyProjectStatus } from "@/lib/projects/project-lifecycle";
import { maxBudgetForOperation } from "@/lib/ai/cost-budget";
import { routeOperation } from "@/lib/ai/model-router";

type Writer = SupabaseClient<Database>;

export type RunUserAiRepairResult =
  | {
      ok: true;
      repaired: boolean;
      fileCount: number;
      checkpointId: string | null;
      reservedCredits: number;
      refundedCredits: number;
      lifecycle: string;
      reasons: string[];
    }
  | { ok: false; error: string; code: string; refundedCredits?: number };

export async function runUserAiRepair(input: {
  writer: Writer;
  projectId: string;
  userId: string;
  userEmail: string;
  balance: number;
  issueType?: string;
}): Promise<RunUserAiRepairResult> {
  const generationId = randomUUID();
  const repairSpec = routeOperation({
    operationType: "code_repair_small",
    ownerEmail: input.userEmail,
  });
  const providerUsd = maxBudgetForOperation("code_repair_small");

  const quote = quoteGenerationCost({
    mode: "repair",
    selectedModel: repairSpec.apiModelId,
    estimatedProviderCostUsd: providerUsd,
    complexity: 5,
    expectedFiles: 8,
  });

  const reserve = await reserveCreditsForGeneration(input.writer, {
    userId: input.userId,
    userEmail: input.userEmail,
    generationId,
    projectId: input.projectId,
    mode: "repair",
    selectedModel: repairSpec.apiModelId,
    estimatedProviderCostUsd: providerUsd,
    balance: input.balance,
    complexity: 5,
    expectedFiles: 8,
  });

  if (!reserve.ok) {
    return {
      ok: false,
      error: reserve.error,
      code: reserve.code,
    };
  }

  const reservedCredits = reserve.reserved;
  let providerCostUsd = providerUsd;
  let success = false;
  let checkpointId: string | null = null;
  let repaired = false;
  let fileCount = 0;
  let reasons: string[] = [];

  try {
    const { data: fileRows } = await input.writer
      .from("app_files")
      .select("path, content")
      .eq("project_id", input.projectId);

    const files: BuildFile[] = (fileRows ?? [])
      .filter((f) => f.path && f.content != null)
      .map((f) => ({ path: f.path!, content: f.content! }));

    fileCount = files.length;
    const assessment = assessBuildQuality(files);
    reasons = assessment.reasons;

    if (files.length === 0 && input.issueType === "no_files") {
      reasons = ["no_files"];
    }

    checkpointId = await saveProjectCheckpoint(
      input.writer,
      input.projectId,
      input.userId,
      "Before AI repair",
      files,
      "manual",
    );

    const { data: project } = await input.writer
      .from("projects")
      .select("metadata, name")
      .eq("id", input.projectId)
      .eq("owner_id", input.userId)
      .maybeSingle();

    const meta = (project?.metadata ?? {}) as Record<string, unknown>;
    const userPrompt =
      typeof meta.last_build_prompt === "string"
        ? meta.last_build_prompt
        : typeof meta.create_prompt === "string"
          ? meta.create_prompt
          : project?.name ?? "App repair";

    const repairPrompt = buildRepairPrompt(
      reasons.length ? reasons : ["Improve incomplete app files"],
      files.length ? files : [{ path: "preview/index.html", content: "<html><body>App</body></html>" }],
      userPrompt,
    );

    const providerResult = await callProviderStructured({
      writer: input.writer,
      userId: input.userId,
      userEmail: input.userEmail,
      operationId: generationId,
      operationType: "code_repair_small",
      system:
        "You repair generated app files. Return only fenced code blocks with file paths. No placeholders.",
      prompt: repairPrompt,
      projectId: input.projectId,
      ownerEmail: input.userEmail,
    });

    providerCostUsd = providerResult.providerCostUsd;
    const parsed = parseFencedFiles(providerResult.text);
    if (parsed.length === 0) {
      reasons = [...reasons, "AI returned no file patches"];
      throw new Error("AI repair produced no changes");
    }

    const merged = new Map(files.map((f) => [f.path, f.content]));
    for (const f of parsed) merged.set(f.path, f.content);
    const nextFiles = [...merged.entries()].map(([path, content]) => ({ path, content }));

    const rows = nextFiles.map((p) => ({
      project_id: input.projectId,
      path: p.path,
      content: p.content,
      language: p.path.split(".").pop() ?? "text",
      mime_type: "text/plain",
      size_bytes: Buffer.byteLength(p.content, "utf8"),
    }));

    const { error: upsertErr } = await input.writer.from("app_files").upsert(rows as never, {
      onConflict: "project_id,path",
    });
    if (upsertErr) throw new Error(upsertErr.message);

    const postCheck = assessBuildQuality(nextFiles);
    repaired = postCheck.ok || parsed.length > 0;
    fileCount = nextFiles.length;
    reasons = postCheck.reasons;
    success = repaired;

    const prevMeta = meta;
    await input.writer
      .from("projects")
      .update({
        build_status: postCheck.ok ? "completed" : "failed",
        status: legacyProjectStatus(postCheck.ok ? "generated" : "needs_attention"),
        metadata: {
          ...prevMeta,
          ...lifecyclePatch(postCheck.ok ? "generated" : "needs_attention", {
            validation_ok: postCheck.ok,
            validation_reasons: postCheck.reasons.slice(0, 10),
            last_repair_at: new Date().toISOString(),
            last_repair_success: success,
          }),
        },
      } as never)
      .eq("id", input.projectId)
      .eq("owner_id", input.userId);

    await reconcileProjectLifecycle(input.writer, input.projectId, input.userId);

    const { refunded } = await reconcileGenerationReservation(input.writer, {
      userId: input.userId,
      generationId,
      reservedCredits,
      actualUserCredits: success ? quote.userCreditsRequired : 0,
      providerCostUsd: success ? providerCostUsd : 0,
      success,
      projectId: input.projectId,
    });

    const { lifecycle } = await reconcileProjectLifecycle(input.writer, input.projectId, input.userId);

    return {
      ok: true,
      repaired,
      fileCount,
      checkpointId,
      reservedCredits,
      refundedCredits: refunded,
      lifecycle,
      reasons,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Repair failed";
    const { refunded } = await reconcileGenerationReservation(input.writer, {
      userId: input.userId,
      generationId,
      reservedCredits,
      actualUserCredits: 0,
      providerCostUsd: 0,
      success: false,
      projectId: input.projectId,
    });

    const { data: failProj } = await input.writer
      .from("projects")
      .select("metadata")
      .eq("id", input.projectId)
      .eq("owner_id", input.userId)
      .maybeSingle();
    const failMeta = (failProj?.metadata ?? {}) as Record<string, unknown>;
    await input.writer
      .from("projects")
      .update({
        metadata: {
          ...failMeta,
          last_repair_error: message,
          last_repair_at: new Date().toISOString(),
          last_repair_success: false,
          provider_cap_hit: /cap|429|rate limit/i.test(message),
        },
      } as never)
      .eq("id", input.projectId)
      .eq("owner_id", input.userId);

    return {
      ok: false,
      error: message,
      code: "repair_failed",
      refundedCredits: refunded,
    };
  }
}
