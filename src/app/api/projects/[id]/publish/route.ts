import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { publicWebUrlForSubdomain } from "@/lib/publish/subdomain";
import { getAppUrl } from "@/lib/app-url";
import { startPublish, resolveDisplayPublicUrl } from "@/lib/publish/publish-service";
import { wildcardSubdomainEnabled } from "@/lib/publish/publish-config";
import { requireProjectId, jsonMissingId } from "@/lib/ids/required-ids";
import { requireAuthUser, requireMutationProjectId, isNextResponse } from "@/lib/ids/api-mutation-guard";
import { guardExpensiveRoute } from "@/lib/security/route-guard";
import { requireOwnedProject, isOwnedProjectFailure } from "@/lib/security/owned-project";
import { logSecurityAudit } from "@/lib/security/audit-events";

export const dynamic = "force-dynamic";

/**
 * Publish metadata: public subdomain URL, plan gates, etc.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: prof } = await supabase.from("profiles").select("plan_id").eq("id", user.id).maybeSingle();
  const planId = prof?.plan_id ?? "free";

  const { data: project } = await supabase
    .from("projects")
    .select("id, owner_id, slug, name, published_subdomain, custom_domain, metadata")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sub = (project as { published_subdomain?: string | null }).published_subdomain?.trim() ?? null;
  const publicWebUrl = resolveDisplayPublicUrl(project) ?? (sub ? publicWebUrlForSubdomain(sub) : null);

  const p = (planId ?? "free").toLowerCase();
  const customDomainAllowed = p === "pro" || p === "business" || p === "enterprise";

  return NextResponse.json({
    projectId,
    planId,
    subdomain: sub,
    publicWebUrl,
    customDomain: project.custom_domain ?? null,
    customDomainAllowed,
    platformBaseDomain: "dreamos86.com",
    publishMode: wildcardSubdomainEnabled() ? "subdomain" : "path",
  });
}

/**
 * Ensure a unique subdomain is allocated and returned (idempotent if already set).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await ctx.params;
  const projectId = requireMutationProjectId(rawId);
  if (isNextResponse(projectId)) return projectId;

  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();
  const authUser = guardExpensiveRoute(sessionUser, "publish");
  if (isNextResponse(authUser)) return authUser;

  let body: { slug?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* optional body */
  }

  const admin = createServiceRoleClient() ?? supabase;
  const owned = await requireOwnedProject(admin, projectId, authUser.id);
  if (isOwnedProjectFailure(owned)) return owned;

  const result = await startPublish({
    writer: admin,
    userId: authUser.id,
    projectId,
    customSlug: body.slug?.trim() || null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
  }

  await logSecurityAudit({
    userId: authUser.id,
    action: "publish",
    projectId,
    metadata: { publicUrl: result.publicUrl ?? null, slug: result.slug ?? null },
    request: req,
  });

  const iconUrl = `${getAppUrl().replace(/\/$/, "")}/api/projects/${projectId}/icon`;
  await admin
    .from("projects")
    .update({ icon_url: iconUrl } as never)
    .eq("id", projectId)
    .eq("owner_id", authUser.id);

  return NextResponse.json({
    subdomain: result.slug,
    publicWebUrl: result.publicUrl,
    publishMode: result.mode,
    iconUrl,
  });
}
