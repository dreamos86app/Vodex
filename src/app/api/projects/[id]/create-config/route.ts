import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireProjectId, jsonMissingId } from "@/lib/ids/required-ids";
import { requireAuthUser, isNextResponse } from "@/lib/ids/api-mutation-guard";
import {
  createFlowConfigPatch,
  readCreateFlowConfig,
  type CreateFlowConfig,
} from "@/lib/create/create-flow-config";
import type { CreateFlowState } from "@/lib/create/create-flow-state";
export const dynamic = "force-dynamic";

const VALID_TIERS = new Set(["quick", "standard", "production"]);
const VALID_STATES = new Set([
  "idle",
  "classifying_intent",
  "intent_ready",
  "needs_clarification",
  "project_creating",
  "project_ready",
  "blueprint_generating",
  "blueprint_ready",
  "quote_ready",
  "awaiting_build_confirmation",
  "build_queued",
  "building",
  "generated",
  "preview_ready",
  "needs_attention",
  "failed",
]);

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const projectId = requireProjectId(rawId);
  if (!projectId) return jsonMissingId("projectId", "Project id is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const auth = requireAuthUser(user);
  if (isNextResponse(auth)) return auth;

  const { data: project } = await supabase
    .from("projects")
    .select("id, metadata")
    .eq("id", projectId)
    .eq("owner_id", auth.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ config: readCreateFlowConfig(project.metadata) });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const projectId = requireProjectId(rawId);
  if (!projectId) return jsonMissingId("projectId", "Project id is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const auth = requireAuthUser(user);
  if (isNextResponse(auth)) return auth;

  let body: Partial<CreateFlowConfig> & { createFlowState?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.buildTier && !VALID_TIERS.has(body.buildTier)) {
    return NextResponse.json({ error: "Invalid build tier" }, { status: 400 });
  }
  if (body.createFlowState && !VALID_STATES.has(body.createFlowState)) {
    return NextResponse.json({ error: "Invalid flow state" }, { status: 400 });
  }

  const writer = createServiceRoleClient() ?? supabase;
  const { data: project } = await writer
    .from("projects")
    .select("id, metadata")
    .eq("id", projectId)
    .eq("owner_id", auth.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prevMeta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const flowState = body.createFlowState as CreateFlowState | undefined;
  const patch = createFlowConfigPatch({
    templateId: body.templateId,
    stylePresetId: body.stylePresetId,
    buildTier: body.buildTier,
    userPrompt: body.userPrompt,
    createFlowState: flowState,
  });

  await writer
    .from("projects")
    .update({
      metadata: { ...prevMeta, ...patch },
    } as never)
    .eq("id", projectId);

  return NextResponse.json({ ok: true, config: readCreateFlowConfig({ ...prevMeta, ...patch }) });
}
