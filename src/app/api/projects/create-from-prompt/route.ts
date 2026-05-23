import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { bootstrapProfileFromOAuth } from "@/lib/auth/profile-bootstrap";
import { createProjectFromPrompt } from "@/lib/projects/create-project-from-prompt";
import { requireProjectId, jsonMissingId } from "@/lib/ids/required-ids";
import { guardExpensiveRoute } from "@/lib/security/route-guard";
import { isNextResponse } from "@/lib/ids/api-mutation-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  let prompt = "";
  let source: "prompt" | "template" | "import" = "prompt";
  let existingProjectId: string | null = null;
  let templateId: string | null = null;
  let stylePresetId: string | null = null;
  let buildTier: "quick" | "standard" | "production" = "standard";
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
    prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (body.source === "template" || body.source === "import") source = body.source;
    existingProjectId = requireProjectId(
      typeof body.projectId === "string" ? body.projectId : null,
    );
    templateId = typeof body.templateId === "string" ? body.templateId : null;
    stylePresetId = typeof body.stylePresetId === "string" ? body.stylePresetId : null;
    if (body.buildTier === "quick" || body.buildTier === "production" || body.buildTier === "standard") {
      buildTier = body.buildTier;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const authUser = guardExpensiveRoute(sessionUser, "build", body);
  if (isNextResponse(authUser)) return authUser;

  if (!prompt) return jsonMissingId("prompt", "Describe your app idea.");

  try {
    await bootstrapProfileFromOAuth(authUser, null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "profile_bootstrap_failed";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const writer = createServiceRoleClient() ?? supabase;
  const result = await createProjectFromPrompt({
    writer,
    userId: authUser.id,
    prompt,
    source,
    existingProjectId,
    templateId,
    stylePresetId,
    buildTier,
  });

  if (!result.ok) {
    const status =
      result.code === "question_only" || result.code === "needs_clarification"
        ? 200
        : result.code === "not_found"
          ? 404
          : 400;
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        code: result.code,
        intent: result.intent,
        userMessage: result.userMessage,
      },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    projectId: result.projectId,
    slug: result.slug,
    intent: result.intent,
    lifecycleStatus: result.lifecycleStatus,
    shouldFullBuild: result.shouldFullBuild,
    userMessage: result.userMessage,
    builderUrl: `/create?projectId=${result.projectId}`,
  });
}
