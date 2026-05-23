import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  buildAppBlueprint,
  parseAppBlueprint,
  requiresBlueprintApproval,
  sanitizeBlueprintForUser,
} from "@/lib/build/app-blueprint";
import type { BlueprintQualityLevel } from "@/lib/build/blueprint-schema";
import { getGenerationCache, setGenerationCache } from "@/lib/ai/generation-cache";
import { hashPromptBlueprintKey } from "@/lib/ai/file-fingerprint";
import { compressProjectContext } from "@/lib/ai/prompt-compressor";
import { resolveStageModel } from "@/lib/ai/model-cost-runtime";
import { requireAuthUser, requireMutationProjectId, isNextResponse } from "@/lib/ids/api-mutation-guard";
import { guardExpensiveRoute } from "@/lib/security/route-guard";
import { loadProfileBillingRow } from "@/lib/supabase/load-profile-billing";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  let body: {
    prompt?: string;
    templateId?: string;
    stylePresetId?: string;
    modelId?: string;
    projectId?: string;
    qualityLevel?: string;
    mode?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const authUser = guardExpensiveRoute(sessionUser, "blueprint", body as Record<string, unknown>);
  if (isNextResponse(authUser)) return authUser;

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const quality = (["quick", "standard", "production", "premium"].includes(body.qualityLevel ?? "")
    ? body.qualityLevel
    : "standard") as BlueprintQualityLevel;

  if (body.projectId) {
    const pid = requireMutationProjectId(body.projectId);
    if (isNextResponse(pid)) return pid;
  }

  const { row: billing } = await loadProfileBillingRow(supabase, authUser);
  const costPlan = resolveStageModel({
    stage: "blueprint",
    mode: "build",
    qualityLevel: quality === "premium" ? "premium" : quality === "production" ? "production" : quality === "quick" ? "quick" : "standard",
    userCreditsBalance: billing?.credits_remaining ?? 0,
    requestedModelId: body.modelId,
  });

  const cacheKey = hashPromptBlueprintKey({
    prompt,
    templateId: body.templateId ?? null,
    projectId: body.projectId ?? null,
    stylePresetId: body.stylePresetId ?? null,
  });

  const cacheNs = quality === "quick" ? "blueprint_quick" : "blueprint_llm";
  const cached = getGenerationCache<Awaited<ReturnType<typeof buildAppBlueprint>>["blueprint"]>(
    cacheNs,
    `${cacheKey}:${quality}`,
  );
  if (cached) {
    return NextResponse.json({
      blueprint: sanitizeBlueprintForUser(cached),
      cached: true,
      requiresApproval: requiresBlueprintApproval(quality),
    });
  }

  let existingFiles: Array<{ path: string; content: string }> | undefined;
  if (body.projectId) {
    const writer = createServiceRoleClient() ?? supabase;
    const { data: files } = await writer
      .from("app_files")
      .select("path, content")
      .eq("project_id", body.projectId)
      .limit(80);
    existingFiles = (files ?? [])
      .filter((f) => f.path && f.content != null)
      .map((f) => ({ path: f.path!, content: f.content! }));
    if (existingFiles.length) {
      compressProjectContext(existingFiles, new Set());
    }
  }

  const blueprintModelId = costPlan.route.modelId ?? body.modelId;

  const result = await buildAppBlueprint({
    prompt,
    templateId: body.templateId,
    stylePresetId: body.stylePresetId,
    modelId: blueprintModelId,
    qualityLevel: quality,
    mode: body.mode === "llm_enriched" ? "llm_enriched" : quality === "quick" ? "deterministic_quick" : "llm_enriched",
    userId: authUser.id,
    userEmail: authUser.email ?? "",
    projectId: body.projectId,
    operationId: `blueprint:${authUser.id}:${cacheKey}`,
    existingFiles,
  });

  const valid = parseAppBlueprint(result.blueprint);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error, code: "invalid_blueprint" }, { status: 422 });
  }

  setGenerationCache(cacheNs, `${cacheKey}:${quality}`, valid.blueprint);

  if (body.projectId) {
    const writer = createServiceRoleClient() ?? supabase;
    const metaKey = "approved_blueprint";
    await writer
      .from("projects")
      .select("metadata")
      .eq("id", body.projectId)
      .eq("owner_id", authUser.id)
      .maybeSingle()
      .then(async ({ data: proj }) => {
        const meta = (proj?.metadata ?? {}) as Record<string, unknown>;
        if (quality === "quick") {
          await writer
            .from("projects")
            .update({
              metadata: {
                ...meta,
                [metaKey]: valid.blueprint,
                blueprint_approved_at: new Date().toISOString(),
              },
            } as never)
            .eq("id", body.projectId!)
            .eq("owner_id", authUser.id);
        }
      });
  }

  return NextResponse.json({
    blueprint: sanitizeBlueprintForUser(valid.blueprint),
    cached: false,
    requiresApproval: requiresBlueprintApproval(quality),
    optimizedContext: true,
  });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  let body: { blueprint?: unknown; projectId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const authUser = guardExpensiveRoute(sessionUser, "blueprint", body as Record<string, unknown>);
  if (isNextResponse(authUser)) return authUser;

  const valid = parseAppBlueprint(body.blueprint);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 422 });
  }

  if (body.projectId) {
    const writer = createServiceRoleClient() ?? supabase;
    const { data: proj } = await writer
      .from("projects")
      .select("metadata")
      .eq("id", body.projectId)
      .eq("owner_id", authUser.id)
      .maybeSingle();
    const meta = (proj?.metadata ?? {}) as Record<string, unknown>;
    await writer
      .from("projects")
      .update({
        metadata: {
          ...meta,
          approved_blueprint: valid.blueprint,
          blueprint_approved_at: new Date().toISOString(),
        },
      } as never)
      .eq("id", body.projectId)
      .eq("owner_id", authUser.id);
  }

  return NextResponse.json({
    blueprint: sanitizeBlueprintForUser(valid.blueprint),
    approved: true,
  });
}
