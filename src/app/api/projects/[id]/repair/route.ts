import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadRepairContext } from "@/lib/repair/repair-context";
import { runUserAiRepair } from "@/lib/repair/run-user-ai-repair";
import { reconcileProjectLifecycle } from "@/lib/projects/reconcile-lifecycle";
import { startPreviewSession } from "@/lib/preview/preview-build-service";
import { requireProjectId, jsonMissingId } from "@/lib/ids/required-ids";
import { loadProfileBillingRow } from "@/lib/supabase/load-profile-billing";
import { requireAuthUser, requireMutationProjectId, isNextResponse } from "@/lib/ids/api-mutation-guard";
import { quoteGenerationCost } from "@/lib/billing/credit-profit-guard";
import { routeOperation } from "@/lib/ai/model-router";
import { maxBudgetForOperation } from "@/lib/ai/cost-budget";
import type { RepairIssueType } from "@/lib/repair/repair-classifier";
import { logSecurityAudit } from "@/lib/security/audit-events";
import { guardExpensiveRoute } from "@/lib/security/route-guard";

export const dynamic = "force-dynamic";

const ROOT = process.cwd();

function readSqlFile(rel: string): string | null {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const projectId = requireProjectId(rawId);
  if (!projectId) return jsonMissingId("projectId", "Project id is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const writer = createServiceRoleClient() ?? supabase;
  const { row: billing } = await loadProfileBillingRow(supabase, user);
  const ctxResult = await loadRepairContext(writer, projectId, user.id, billing?.credits_remaining ?? 0);
  if (!ctxResult) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const repairSpec = routeOperation({ operationType: "code_repair_small", ownerEmail: user.email });
  const quote = quoteGenerationCost({
    mode: "repair",
    selectedModel: repairSpec.apiModelId,
    estimatedProviderCostUsd: maxBudgetForOperation("code_repair_small"),
    complexity: 5,
  });

  const quotes: Record<string, { estimatedCost: number; reservedEstimate: number; safeToRun: boolean }> = {};
  for (const issue of ctxResult.issues) {
    if (issue.needsAi) {
      quotes[issue.type] = {
        estimatedCost: quote.userCreditsRequired,
        reservedEstimate: quote.userCreditsReserved,
        safeToRun: (billing?.credits_remaining ?? 0) >= quote.userCreditsReserved && quote.safeToRun,
      };
    }
  }

  return NextResponse.json({
    issues: ctxResult.issues,
    actions: ctxResult.actions,
    quotes,
    creditsRemaining: ctxResult.creditsRemaining,
    lifecycle: ctxResult.lifecycle,
    fileCount: ctxResult.fileCount,
    lastCheckpointId: ctxResult.lastCheckpointId,
    technicalBundle: ctxResult.technicalBundle,
  });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const { id: rawId } = await ctx.params;
  const projectId = requireMutationProjectId(rawId);
  if (isNextResponse(projectId)) return projectId;

  let body: { action?: string; issueType?: RepairIssueType; checkpointId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const authUser = guardExpensiveRoute(sessionUser, "repair", body as Record<string, unknown>);
  if (isNextResponse(authUser)) return authUser;

  const action = body.action;
  if (!action) return NextResponse.json({ error: "action required" }, { status: 400 });

  const writer = createServiceRoleClient() ?? supabase;
  const { row: billing } = await loadProfileBillingRow(supabase, authUser);

  if (action === "reconcile") {
    const result = await reconcileProjectLifecycle(writer, projectId, authUser.id);
    return NextResponse.json({ ok: true, action, lifecycle: result.lifecycle, reconciled: result.reconciled });
  }

  if (action === "retry_preview") {
    const result = await startPreviewSession({ writer, userId: authUser.id, projectId });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, action, error: result.error, code: result.code },
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      action,
      previewUrl: result.previewUrl,
      status: result.status,
      providerLevel: result.providerLevel,
    });
  }

  if (action === "show_sql") {
    const sql = readSqlFile("scripts/dreamos-runtime-repair.sql");
    if (!sql) return NextResponse.json({ error: "SQL file not found" }, { status: 404 });
    return NextResponse.json({
      ok: true,
      action,
      sqlFile: "scripts/dreamos-runtime-repair.sql",
      sql,
    });
  }

  if (action === "rollback_checkpoint") {
    const checkpointId = body.checkpointId;
    if (!checkpointId) {
      return NextResponse.json({ error: "checkpointId required" }, { status: 400 });
    }
    const { data: proj } = await writer
      .from("projects")
      .select("metadata")
      .eq("id", projectId)
      .eq("owner_id", authUser.id)
      .maybeSingle();
    const meta = (proj?.metadata ?? {}) as {
      editor_checkpoints?: Array<{ id: string; files: Array<{ path: string; content: string }> }>;
    };
    const cp = meta.editor_checkpoints?.find((c) => c.id === checkpointId);
    if (!cp?.files?.length) {
      return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
    }
    const rows = cp.files.map((p) => ({
      project_id: projectId,
      path: p.path,
      content: p.content,
      language: p.path.split(".").pop() ?? "text",
      mime_type: "text/plain",
      size_bytes: Buffer.byteLength(p.content, "utf8"),
    }));
    const { error } = await writer.from("app_files").upsert(rows as never, {
      onConflict: "project_id,path",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await reconcileProjectLifecycle(writer, projectId, authUser.id);
    return NextResponse.json({ ok: true, action, restoredFiles: cp.files.length });
  }

  if (action === "run_ai_repair") {
    const result = await runUserAiRepair({
      writer,
      projectId,
      userId: authUser.id,
      userEmail: authUser.email ?? "",
      balance: billing?.credits_remaining ?? 0,
      issueType: body.issueType,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          action,
          error: result.error,
          code: result.code,
          refundedCredits: result.refundedCredits ?? 0,
        },
        { status: result.code === "insufficient_tokens" ? 402 : 500 },
      );
    }
    await logSecurityAudit({
      userId: authUser.id,
      action: "repair",
      projectId,
      metadata: {
        issueType: body.issueType ?? null,
        fileCount: result.fileCount,
        checkpointId: result.checkpointId,
        reservedCredits: result.reservedCredits,
      },
      request,
    });
    return NextResponse.json({
      ok: true,
      action,
      repaired: result.repaired,
      fileCount: result.fileCount,
      checkpointId: result.checkpointId,
      reservedCredits: result.reservedCredits,
      refundedCredits: result.refundedCredits,
      lifecycle: result.lifecycle,
      reasons: result.reasons,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
